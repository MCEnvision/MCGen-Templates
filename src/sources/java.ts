import { canonicalJson, compareText } from "../canonical-json.js";
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

const mojangMetadataPrefix = "mojang-version-metadata:";

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
  const staticResources = javaSourceIds.map((sourceId) =>
    requireJavaResource(resources, sourceId),
  );
  const manifest = staticResources[0];
  if (!manifest) {
    throw new Error("java adapter source ordering is incomplete");
  }
  const versionMetadata = [...resources.entries()]
    .filter(([key]) => key.startsWith(mojangMetadataPrefix))
    .sort(([left], [right]) => compareText(left, right));
  const orderedResources = [
    ...staticResources,
    ...versionMetadata.map(([, resource]) => resource),
  ];
  const metadataIndexByVersion = new Map(
    versionMetadata.map(([key], index) => [
      key.slice(mojangMetadataPrefix.length),
      staticResources.length + index,
    ]),
  );
  const entries: SnapshotEntry[] = [];
  const rejected: RejectedEntry[] = [];
  for (const version of parseMojangManifest(manifest.text).versions) {
    const sourceIndex = metadataIndexByVersion.get(version.id);
    if (sourceIndex === undefined) {
      rejected.push({
        value: version.id,
        reason:
          "official Mojang version metadata was not captured for this manifest version",
        sourceIndex: 0,
      });
      continue;
    }
    const metadata = orderedResources[sourceIndex];
    if (!metadata) {
      throw new Error("java adapter metadata source ordering is incomplete");
    }
    const provenance = metadata.record.derivedFrom;
    if (
      metadata.record.sourceId !== "mojang-version-metadata" ||
      metadata.record.requestedUrl !== version.url ||
      provenance?.sourceId !== "mojang-version-manifest" ||
      provenance.sha256 !== manifest.record.sha256 ||
      provenance.selector !== `version:${version.id}`
    ) {
      rejected.push({
        value: version.id,
        reason:
          "captured Mojang version metadata does not preserve manifest provenance",
        sourceIndex,
      });
      continue;
    }
    try {
      entries.push(
        javaRequirementEntryFromMetadata(
          version.id,
          metadata.text,
          sourceIndex,
        ),
      );
    } catch (error) {
      rejected.push({
        value: version.id,
        reason: `captured Mojang version metadata is invalid, ${error instanceof Error ? error.message : String(error)}`,
        sourceIndex,
      });
    }
  }
  entries.sort(
    (left, right) =>
      compareText(left.catalogKey, right.catalogKey) ||
      compareText(left.version, right.version),
  );
  rejected.sort(
    (left, right) =>
      compareText(left.value, right.value) ||
      compareText(left.reason, right.reason) ||
      left.sourceIndex - right.sourceIndex,
  );
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
    entries,
    rejected,
    warnings: [
      "Platform documentation is retained as corroborating evidence and is not parsed into compatibility assertions",
      ...(rejected.length
        ? [
            `${rejected.length} Minecraft versions remain blocked by missing or invalid official Mojang Java metadata`,
          ]
        : []),
    ],
  };
}
