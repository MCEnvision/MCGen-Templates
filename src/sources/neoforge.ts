import { canonicalJson, compareText } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import { classifyMavenVersion, parseMavenVersions } from "./maven.js";

export const neoForgeAdapterVersion = "1.1.0";

type NeoForgeSnapshotSourceId =
  | "neoforge-maven-metadata"
  | "neoforge-moddevgradle-maven-metadata"
  | "neoforge-userdev-maven-metadata"
  | "neoforge-common-maven-metadata"
  | "neoforge-neoform-maven-metadata"
  | "neoforge-neoform-runtime-maven-metadata"
  | "neoforge-versioning-documentation";

function requireNeoForgeResource(
  resources: ReadonlyMap<string, FetchedResource>,
  sourceId: NeoForgeSnapshotSourceId,
): FetchedResource {
  const resource = resources.get(sourceId);
  if (!resource) {
    throw new Error(`neoforge adapter requires source ${sourceId}`);
  }
  return resource;
}

export function minecraftKeyFromNeoForgeVersion(
  version: string,
): string | undefined {
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?/u.exec(version);
  if (!match) return undefined;
  const [, major, minor] = match;
  if (major === "1") {
    return match[3] ? `1.${minor}.${match[3]}` : `1.${minor}`;
  }
  const majorNumber = Number(major);
  if (majorNumber >= 20 && majorNumber <= 23) {
    return minor === "0" ? `1.${major}` : `1.${major}.${minor}`;
  }
  if (majorNumber >= 24) {
    return `${major}.${minor}`;
  }
  return undefined;
}

function mavenComponentEntries(
  resource: FetchedResource,
  sourceIndex: number,
  component: string,
  coordinate: string,
  catalogKey: (version: string) => string | undefined,
): { entries: SnapshotEntry[] } {
  const entries: SnapshotEntry[] = [];
  for (const version of parseMavenVersions(resource.text)) {
    const key = catalogKey(version);
    if (!key) {
      entries.push({
        platform: "neoforge",
        component,
        catalogKey: "unresolved",
        version,
        coordinate: `${coordinate}:${version}`,
        channel: classifyMavenVersion(version),
        compatibility: "unresolved",
        details: {
          catalogKeyStatus: "unresolved",
          unresolvedReason:
            "version does not encode an authoritative minecraft key",
        },
        sourceIndexes: [sourceIndex],
      });
      continue;
    }
    entries.push({
      platform: "neoforge",
      component,
      catalogKey: key,
      version,
      coordinate: `${coordinate}:${version}`,
      channel: classifyMavenVersion(version),
      compatibility: "declared",
      sourceIndexes: [sourceIndex],
    });
  }
  return { entries };
}

export function buildNeoForgeSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const neoForge = requireNeoForgeResource(
    resources,
    "neoforge-maven-metadata",
  );
  const modDevGradle = requireNeoForgeResource(
    resources,
    "neoforge-moddevgradle-maven-metadata",
  );
  const userdev = requireNeoForgeResource(
    resources,
    "neoforge-userdev-maven-metadata",
  );
  const common = requireNeoForgeResource(
    resources,
    "neoforge-common-maven-metadata",
  );
  const neoForm = requireNeoForgeResource(
    resources,
    "neoforge-neoform-maven-metadata",
  );
  const neoFormRuntime = requireNeoForgeResource(
    resources,
    "neoforge-neoform-runtime-maven-metadata",
  );
  const versioningDocumentation = requireNeoForgeResource(
    resources,
    "neoforge-versioning-documentation",
  );
  const orderedResources = [
    neoForge,
    modDevGradle,
    userdev,
    common,
    neoForm,
    neoFormRuntime,
    versioningDocumentation,
  ];
  const groups = [
    mavenComponentEntries(
      neoForge,
      0,
      "loader",
      "net.neoforged:neoforge",
      minecraftKeyFromNeoForgeVersion,
    ),
    mavenComponentEntries(
      modDevGradle,
      1,
      "build-plugin",
      "net.neoforged:moddev-gradle",
      () => "all",
    ),
    mavenComponentEntries(
      userdev,
      2,
      "userdev",
      "net.neoforged.gradle:userdev",
      minecraftKeyFromNeoForgeVersion,
    ),
    mavenComponentEntries(
      common,
      3,
      "gradle-common",
      "net.neoforged.gradle:common",
      minecraftKeyFromNeoForgeVersion,
    ),
    mavenComponentEntries(
      neoForm,
      4,
      "neoform",
      "net.neoforged:neoform",
      minecraftKeyFromNeoForgeVersion,
    ),
    mavenComponentEntries(
      neoFormRuntime,
      5,
      "neoform-runtime",
      "net.neoforged:neoform-runtime",
      minecraftKeyFromNeoForgeVersion,
    ),
  ];
  const entries = groups
    .flatMap((group) => group.entries)
    .sort(
      (left, right) =>
        compareText(left.catalogKey, right.catalogKey) ||
        compareText(left.component, right.component) ||
        compareText(left.version, right.version) ||
        compareText(left.coordinate, right.coordinate),
    );
  const rejected: RejectedEntry[] = [];
  const identity = sha256(
    canonicalJson({
      adapter: { id: "neoforge-maven", version: neoForgeAdapterVersion },
      sources: orderedResources.map((resource) => resource.record.sha256),
    }),
  ).slice(0, 24);
  const warnings = [
    "neoforge-versioning-documentation is preserved as corroborating evidence",
  ];
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `neoforge.${identity}`,
    adapter: { id: "neoforge-maven", version: neoForgeAdapterVersion },
    createdAt,
    sources: orderedResources.map((resource) => resource.record),
    entries,
    rejected,
    warnings,
  };
}
