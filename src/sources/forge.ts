import { XMLParser } from "fast-xml-parser";
import { canonicalJson, compareText } from "../canonical-json.js";
import { sha256 } from "../digest.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
  type StabilityChannel,
} from "../contracts.js";
import { parseMojangVersionIds } from "./mojang.js";

export const forgeAdapterVersion = "1.0.2";

type MavenMetadata = {
  metadata?: {
    versioning?: {
      versions?: {
        version?: unknown;
      };
    };
  };
};

function extractVersions(metadata: MavenMetadata): string[] {
  const value = metadata.metadata?.versioning?.versions?.version;
  const versions = Array.isArray(value) ? value : [value];
  const normalized = versions.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  if (normalized.length === 0) {
    throw new Error("forge maven metadata contains no versions");
  }
  return [...new Set(normalized)].sort(compareText);
}

export function parseForgeVersions(xml: string): string[] {
  const parser = new XMLParser({
    allowBooleanAttributes: false,
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });
  return extractVersions(parser.parse(xml) as MavenMetadata);
}

function classify(version: string): StabilityChannel {
  const normalized = version.toLowerCase();
  if (normalized.includes("snapshot")) return "snapshot";
  if (normalized.includes("alpha")) return "alpha";
  if (normalized.includes("beta")) return "beta";
  if (
    normalized.includes("prerelease") ||
    /(?:^|[_-])pre[0-9]+/u.test(normalized)
  ) {
    return "release-candidate";
  }
  if (/(?:^|[-_.])rc(?:[-_.0-9]|$)/u.test(normalized)) {
    return "release-candidate";
  }
  return "release";
}

export function normalizeForgeVersions(
  forgeVersions: readonly string[],
  minecraftVersions: readonly string[],
): { entries: SnapshotEntry[]; rejected: RejectedEntry[]; warnings: string[] } {
  const keys = [...new Set(minecraftVersions)].sort(
    (left, right) => right.length - left.length || compareText(left, right),
  );
  const entries: SnapshotEntry[] = [];
  const rejected: RejectedEntry[] = [];
  const forgeOnlyKeys = new Set<string>();
  for (const version of [...new Set(forgeVersions)].sort(compareText)) {
    let catalogKey = keys.find((key) => version.startsWith(`${key}-`));
    if (!catalogKey) {
      const separator = version.indexOf("-");
      const forgeKey = separator > 0 ? version.slice(0, separator) : "";
      if (/^[0-9]+(?:\.[0-9]+){1,2}(?:_[a-z0-9.]+)?$/u.test(forgeKey)) {
        catalogKey = forgeKey;
        forgeOnlyKeys.add(forgeKey);
      }
    }
    if (!catalogKey) {
      rejected.push({
        value: version,
        reason: "no exact mojang version prefix matched the forge coordinate",
        sourceIndex: 1,
      });
      continue;
    }
    entries.push({
      platform: "forge",
      component: "loader",
      catalogKey,
      version,
      coordinate: `net.minecraftforge:forge:${version}`,
      channel: classify(version),
      sourceIndexes: forgeOnlyKeys.has(catalogKey) ? [1] : [0, 1],
    });
  }
  const warnings = [...forgeOnlyKeys]
    .sort(compareText)
    .map(
      (key) =>
        `catalog key ${key} was derived from official forge coordinates because it is absent from the current mojang manifest`,
    );
  entries.sort(
    (left, right) =>
      compareText(left.catalogKey, right.catalogKey) ||
      compareText(left.version, right.version),
  );
  return { entries, rejected, warnings };
}

export function buildForgeSnapshot(
  mojang: FetchedResource,
  forge: FetchedResource,
  createdAt: string,
): SourceSnapshot {
  const minecraftVersions = parseMojangVersionIds(mojang.text);
  const forgeVersions = parseForgeVersions(forge.text);
  const {
    entries,
    rejected,
    warnings: normalizationWarnings,
  } = normalizeForgeVersions(forgeVersions, minecraftVersions);
  const identity = sha256(
    canonicalJson({
      adapter: {
        id: "forge-maven",
        version: forgeAdapterVersion,
      },
      sources: [mojang.record.sha256, forge.record.sha256],
    }),
  ).slice(0, 24);
  const warnings = [...normalizationWarnings];
  if (rejected.length) {
    warnings.push(
      `${rejected.length} forge versions require catalog-key review`,
    );
  }
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    snapshotId: `forge.${identity}`,
    adapter: {
      id: "forge-maven",
      version: forgeAdapterVersion,
    },
    createdAt,
    sources: [mojang.record, forge.record],
    entries,
    rejected,
    warnings,
  };
}
