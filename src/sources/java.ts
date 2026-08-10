import { canonicalJson } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import {
  parseMojangJavaRequirement,
  parseMojangManifest,
  type MojangJavaRequirement,
} from "./mojang.js";

export const javaAdapterVersion = "1.0.0";

const javaSourceIds = [
  "mojang-version-manifest",
  "forge-getting-started-documentation",
  "neoforge-user-documentation",
  "paper-getting-started-documentation",
  "velocity-getting-started-documentation",
  "architectury-setup-documentation",
] as const;

function requireJavaResource(
  resources: ReadonlyMap<string, FetchedResource>,
  sourceId: (typeof javaSourceIds)[number],
): FetchedResource {
  const resource = resources.get(sourceId);
  if (!resource) {
    throw new Error(`java adapter requires source ${sourceId}`);
  }
  return resource;
}

export function javaRequirementEntry(
  minecraftVersion: string,
  requirement: MojangJavaRequirement,
  sourceIndex: number,
): SnapshotEntry {
  return {
    platform: "java",
    component: "minecraft-runtime",
    catalogKey: minecraftVersion,
    version: String(requirement.majorVersion),
    coordinate: `com.mojang:${requirement.component}:java-${requirement.majorVersion}`,
    channel: "release",
    sourceIndexes: [sourceIndex],
    details: {
      minecraftVersion,
      runtimeComponent: requirement.component,
      majorVersion: String(requirement.majorVersion),
    },
  };
}

export function javaRequirementEntryFromMetadata(
  minecraftVersion: string,
  metadata: string,
  sourceIndex: number,
): SnapshotEntry {
  return javaRequirementEntry(
    minecraftVersion,
    parseMojangJavaRequirement(metadata),
    sourceIndex,
  );
}

export function buildJavaSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const orderedResources = javaSourceIds.map((sourceId) =>
    requireJavaResource(resources, sourceId),
  );
  const manifest = orderedResources[0];
  if (!manifest) {
    throw new Error("java adapter source ordering is incomplete");
  }
  const rejected: RejectedEntry[] = parseMojangManifest(
    manifest.text,
  ).versions.map((version) => ({
    value: version.id,
    reason:
      "official Mojang version metadata is required before its Java requirement can be derived",
    sourceIndex: 0,
  }));
  const identity = sha256(
    canonicalJson({
      adapter: { id: "java-requirements", version: javaAdapterVersion },
      sources: orderedResources.map((resource) => resource.record.sha256),
    }),
  ).slice(0, 24);
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `java.${identity}`,
    adapter: { id: "java-requirements", version: javaAdapterVersion },
    createdAt,
    sources: orderedResources.map((resource) => resource.record),
    entries: [],
    rejected,
    warnings: [
      "Java requirements remain blocked until verified Mojang version metadata is captured for every Minecraft version",
      "Platform documentation is retained as corroborating evidence and is not parsed into compatibility assertions",
    ],
  };
}
