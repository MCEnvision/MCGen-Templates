import { canonicalJson, compareText } from "../canonical-json.js";
import { sha256 } from "../digest.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
} from "../contracts.js";
import { parseMojangVersionIds } from "./mojang.js";
import { classifyMavenVersion, parseMavenVersions } from "./maven.js";

export const forgeAdapterVersion = "1.0.2";

const forgeSnapshotSourceIds = [
  "mojang-version-manifest",
  "forge-maven-metadata",
  "forgegradle-maven-metadata",
  "mcp-config-maven-metadata",
  "mcp-snapshot-maven-metadata",
  "mcp-stable-maven-metadata",
  "forge-promotions",
] as const;

function requireForgeResource(
  resources: ReadonlyMap<string, FetchedResource>,
  sourceId: (typeof forgeSnapshotSourceIds)[number],
): FetchedResource {
  const resource = resources.get(sourceId);
  if (!resource) {
    throw new Error(`forge adapter requires source ${sourceId}`);
  }
  return resource;
}

export function parseForgeVersions(xml: string): string[] {
  try {
    return parseMavenVersions(xml);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "maven metadata contains no versions"
    ) {
      throw new Error("forge maven metadata contains no versions", {
        cause: error,
      });
    }
    throw error;
  }
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
      channel: classifyMavenVersion(version),
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
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const orderedResources = forgeSnapshotSourceIds.map((sourceId) =>
    requireForgeResource(resources, sourceId),
  );
  const [mojang, forge] = orderedResources;
  if (!mojang || !forge) {
    throw new Error("forge adapter source ordering is incomplete");
  }
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
      sources: orderedResources.map((resource) => resource.record.sha256),
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
    provenanceVersion: 1,
    snapshotId: `forge.${identity}`,
    adapter: {
      id: "forge-maven",
      version: forgeAdapterVersion,
    },
    createdAt,
    sources: orderedResources.map((resource) => resource.record),
    entries,
    rejected,
    warnings,
  };
}
