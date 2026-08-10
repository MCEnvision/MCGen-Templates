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

function minecraftKeyFromVersion(version: string): string | undefined {
  const match =
    /(?:^|[-_])((?:1\.)?\d+\.\d+(?:\.\d+)?(?:[_-](?:pre|rc)\d+)?)/iu.exec(
      version,
    );
  return match?.[1];
}

function mavenComponentEntries(
  resource: FetchedResource,
  sourceIndex: number,
  component: string,
  coordinate: string,
  catalogKey: (version: string) => string | undefined,
): { entries: SnapshotEntry[]; rejected: RejectedEntry[] } {
  const entries: SnapshotEntry[] = [];
  const rejected: RejectedEntry[] = [];
  for (const version of parseMavenVersions(resource.text)) {
    const key = catalogKey(version);
    if (!key) {
      rejected.push({
        value: version,
        reason: `${component} version does not encode a Minecraft catalog key`,
        sourceIndex,
      });
      continue;
    }
    entries.push({
      platform: "forge",
      component,
      catalogKey: key,
      version,
      coordinate: `${coordinate}:${version}`,
      channel: classifyMavenVersion(version),
      sourceIndexes: [sourceIndex],
    });
  }
  return { entries, rejected };
}

function promotionEntries(resource: FetchedResource): {
  entries: SnapshotEntry[];
  rejected: RejectedEntry[];
} {
  const document = JSON.parse(resource.text) as unknown;
  const object: Record<string, unknown> | undefined =
    document !== null &&
    typeof document === "object" &&
    !Array.isArray(document)
      ? (document as Record<string, unknown>)
      : undefined;
  if (
    !object ||
    !Object.hasOwn(object, "promos") ||
    object["promos"] === null ||
    typeof object["promos"] !== "object" ||
    Array.isArray(object["promos"])
  ) {
    throw new Error("forge promotions response must contain a promos object");
  }
  const entries: SnapshotEntry[] = [];
  const rejected: RejectedEntry[] = [];
  for (const [key, value] of Object.entries(object["promos"]).sort(
    ([left], [right]) => compareText(left, right),
  )) {
    const match = /^(.*)-(?:recommended|latest)$/u.exec(key);
    const catalogKey = match?.[1];
    if (!catalogKey || typeof value !== "string" || value.length === 0) {
      rejected.push({
        value: `${key}=${String(value)}`,
        reason:
          "forge promotion must contain a Minecraft key and exact Forge version",
        sourceIndex: 6,
      });
      continue;
    }
    entries.push({
      platform: "forge",
      component: "promotion",
      catalogKey,
      version: value,
      coordinate: `net.minecraftforge:forge-promotion:${key}:${value}`,
      channel: classifyMavenVersion(value),
      sourceIndexes: [6],
    });
  }
  return { entries, rejected };
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
  const loader = normalizeForgeVersions(forgeVersions, minecraftVersions);
  const forgeGradle = mavenComponentEntries(
    requireForgeResource(resources, "forgegradle-maven-metadata"),
    2,
    "build-plugin",
    "net.minecraftforge.gradle:ForgeGradle",
    () => "all",
  );
  const mcpConfig = mavenComponentEntries(
    requireForgeResource(resources, "mcp-config-maven-metadata"),
    3,
    "mappings-config",
    "de.oceanlabs.mcp:mcp_config",
    minecraftKeyFromVersion,
  );
  const mcpSnapshot = mavenComponentEntries(
    requireForgeResource(resources, "mcp-snapshot-maven-metadata"),
    4,
    "mappings-snapshot",
    "de.oceanlabs.mcp:mcp_snapshot",
    minecraftKeyFromVersion,
  );
  const mcpStable = mavenComponentEntries(
    requireForgeResource(resources, "mcp-stable-maven-metadata"),
    5,
    "mappings-stable",
    "de.oceanlabs.mcp:mcp_stable",
    minecraftKeyFromVersion,
  );
  const promotions = promotionEntries(
    requireForgeResource(resources, "forge-promotions"),
  );
  const entries = [
    ...loader.entries,
    ...forgeGradle.entries,
    ...mcpConfig.entries,
    ...mcpSnapshot.entries,
    ...mcpStable.entries,
    ...promotions.entries,
  ].sort(
    (left, right) =>
      compareText(left.catalogKey, right.catalogKey) ||
      compareText(left.component, right.component) ||
      compareText(left.version, right.version) ||
      compareText(left.coordinate, right.coordinate),
  );
  const rejected = [
    ...loader.rejected,
    ...forgeGradle.rejected,
    ...mcpConfig.rejected,
    ...mcpSnapshot.rejected,
    ...mcpStable.rejected,
    ...promotions.rejected,
  ];
  const normalizationWarnings = [...loader.warnings];
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
