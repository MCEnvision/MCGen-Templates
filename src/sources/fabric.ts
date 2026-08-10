import { canonicalJson, compareText } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
  type StabilityChannel,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import { classifyMavenVersion, parseMavenVersions } from "./maven.js";

export const fabricAdapterVersion = "1.0.0";

type FabricSnapshotSourceId =
  | "fabric-meta-game"
  | "fabric-meta-loader"
  | "fabric-meta-yarn"
  | "fabric-meta-intermediary"
  | "fabric-meta-installer"
  | "fabric-api-maven-metadata"
  | "fabric-loom-maven-metadata"
  | "fabric-language-kotlin-maven-metadata";

type FabricVersionRecord = {
  version: string;
  stable: boolean;
  maven?: string;
};

function requireFabricResource(
  resources: ReadonlyMap<string, FetchedResource>,
  sourceId: FabricSnapshotSourceId,
): FetchedResource {
  const resource = resources.get(sourceId);
  if (!resource) {
    throw new Error(`fabric adapter requires source ${sourceId}`);
  }
  return resource;
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function channelFromFabricStability(
  stable: boolean,
  version: string,
): StabilityChannel {
  if (stable) return "release";
  const classified = classifyMavenVersion(version);
  return classified === "release" ? "snapshot" : classified;
}

function isMavenCoordinate(value: string): boolean {
  const segments = value.split(":");
  return (
    segments.length >= 3 && segments.every((segment) => segment.length > 0)
  );
}

function parseFabricRecords(
  text: string,
  sourceId: string,
  sourceIndex: number,
  requiresMavenCoordinate: boolean,
): { records: FabricVersionRecord[]; rejected: RejectedEntry[] } {
  let document: unknown;
  try {
    document = JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${sourceId} response is malformed json`, { cause: error });
  }
  if (!Array.isArray(document)) {
    throw new Error(`${sourceId} response must be an array`);
  }
  if (document.length === 0) {
    throw new Error(`${sourceId} response contains no records`);
  }
  const records: FabricVersionRecord[] = [];
  const rejected: RejectedEntry[] = [];
  document.forEach((value, index) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      rejected.push({
        value: describeValue(value),
        reason: `${sourceId} record must be an object`,
        sourceIndex,
      });
      return;
    }
    const record = value as Record<string, unknown>;
    const version = record["version"];
    const stable = record["stable"];
    const maven = record["maven"];
    if (typeof version !== "string" || version.trim().length === 0) {
      rejected.push({
        value: `record ${index}`,
        reason: `${sourceId} record must contain a nonempty version`,
        sourceIndex,
      });
      return;
    }
    if (typeof stable !== "boolean") {
      rejected.push({
        value: version,
        reason: `${sourceId} record must contain a boolean stable flag`,
        sourceIndex,
      });
      return;
    }
    if (requiresMavenCoordinate) {
      if (typeof maven !== "string" || !isMavenCoordinate(maven)) {
        rejected.push({
          value: version,
          reason: `${sourceId} record must contain a Maven coordinate`,
          sourceIndex,
        });
        return;
      }
      records.push({ version, stable, maven });
      return;
    }
    records.push({ version, stable });
  });
  if (records.length === 0) {
    throw new Error(`${sourceId} response contains no valid records`);
  }
  return { records, rejected };
}

function minecraftCatalogKey(version: string): string | undefined {
  return /^(?:1\.)?\d+\.\d+(?:\.\d+)?/u.exec(version)?.[0];
}

function fabricApiCatalogKey(version: string): string | undefined {
  return /\+((?:1\.)?\d+\.\d+(?:\.\d+)?)$/u.exec(version)?.[1];
}

function metaEntries(
  records: readonly FabricVersionRecord[],
  sourceIndex: number,
  component: string,
  catalogKey: (version: string) => string | undefined,
  coordinate: (record: FabricVersionRecord) => string,
): { entries: SnapshotEntry[]; rejected: RejectedEntry[] } {
  const entries: SnapshotEntry[] = [];
  const rejected: RejectedEntry[] = [];
  for (const record of records) {
    const key = catalogKey(record.version);
    if (!key) {
      rejected.push({
        value: record.version,
        reason: `${component} version does not encode an authoritative catalog key`,
        sourceIndex,
      });
      continue;
    }
    entries.push({
      platform: "fabric",
      component,
      catalogKey: key,
      version: record.version,
      coordinate: coordinate(record),
      channel: channelFromFabricStability(record.stable, record.version),
      sourceIndexes: [sourceIndex],
    });
  }
  return { entries, rejected };
}

function mavenEntries(
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
        reason: `${component} version does not encode an authoritative catalog key`,
        sourceIndex,
      });
      continue;
    }
    entries.push({
      platform: "fabric",
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

export function buildFabricSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const game = requireFabricResource(resources, "fabric-meta-game");
  const loader = requireFabricResource(resources, "fabric-meta-loader");
  const yarnResource = requireFabricResource(resources, "fabric-meta-yarn");
  const intermediaryResource = requireFabricResource(
    resources,
    "fabric-meta-intermediary",
  );
  const installerResource = requireFabricResource(
    resources,
    "fabric-meta-installer",
  );
  const fabricApi = requireFabricResource(
    resources,
    "fabric-api-maven-metadata",
  );
  const loom = requireFabricResource(resources, "fabric-loom-maven-metadata");
  const languageKotlin = requireFabricResource(
    resources,
    "fabric-language-kotlin-maven-metadata",
  );
  const orderedResources = [
    game,
    loader,
    yarnResource,
    intermediaryResource,
    installerResource,
    fabricApi,
    loom,
    languageKotlin,
  ];
  const games = parseFabricRecords(game.text, "fabric-meta-game", 0, false);
  const loaders = parseFabricRecords(
    loader.text,
    "fabric-meta-loader",
    1,
    true,
  );
  const yarn = parseFabricRecords(
    yarnResource.text,
    "fabric-meta-yarn",
    2,
    true,
  );
  const intermediary = parseFabricRecords(
    intermediaryResource.text,
    "fabric-meta-intermediary",
    3,
    true,
  );
  const installer = parseFabricRecords(
    installerResource.text,
    "fabric-meta-installer",
    4,
    true,
  );
  const entryGroups = [
    metaEntries(
      games.records,
      0,
      "minecraft",
      minecraftCatalogKey,
      (record) => `com.mojang:minecraft:${record.version}`,
    ),
    metaEntries(
      loaders.records,
      1,
      "loader",
      () => "all",
      (record) => record.maven ?? "",
    ),
    metaEntries(
      yarn.records,
      2,
      "mappings-yarn",
      minecraftCatalogKey,
      (record) => record.maven ?? "",
    ),
    metaEntries(
      intermediary.records,
      3,
      "mappings-intermediary",
      minecraftCatalogKey,
      (record) => record.maven ?? "",
    ),
    metaEntries(
      installer.records,
      4,
      "installer",
      () => "all",
      (record) => record.maven ?? "",
    ),
    mavenEntries(
      fabricApi,
      5,
      "fabric-api",
      "net.fabricmc.fabric-api:fabric-api",
      fabricApiCatalogKey,
    ),
    mavenEntries(
      loom,
      6,
      "build-plugin",
      "net.fabricmc:fabric-loom",
      () => "all",
    ),
    mavenEntries(
      languageKotlin,
      7,
      "language-kotlin",
      "net.fabricmc:fabric-language-kotlin",
      () => "all",
    ),
  ];
  const entries = entryGroups
    .flatMap((group) => group.entries)
    .sort(
      (left, right) =>
        compareText(left.catalogKey, right.catalogKey) ||
        compareText(left.component, right.component) ||
        compareText(left.version, right.version) ||
        compareText(left.coordinate, right.coordinate),
    );
  const rejected = [
    ...games.rejected,
    ...loaders.rejected,
    ...yarn.rejected,
    ...intermediary.rejected,
    ...installer.rejected,
    ...entryGroups.flatMap((group) => group.rejected),
  ];
  const identity = sha256(
    canonicalJson({
      adapter: { id: "fabric-meta", version: fabricAdapterVersion },
      sources: orderedResources.map((resource) => resource.record.sha256),
    }),
  ).slice(0, 24);
  const warnings: string[] = [];
  if (rejected.length) {
    warnings.push(
      `${rejected.length} fabric records require catalog-key review`,
    );
  }
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `fabric.${identity}`,
    adapter: { id: "fabric-meta", version: fabricAdapterVersion },
    createdAt,
    sources: orderedResources.map((resource) => resource.record),
    entries,
    rejected,
    warnings,
  };
}
