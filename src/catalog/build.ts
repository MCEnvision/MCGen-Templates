import { canonicalJson, compareText } from "../canonical-json.js";
import { sha256 } from "../digest.js";
import { buildCoverageReport } from "./coverage.js";
import type {
  CatalogBuildInput,
  CatalogBuildResult,
  CatalogComponent,
  CatalogEdge,
  CatalogPlatformIndex,
  CatalogShard,
  SnapshotInput,
  SnapshotReference,
  SourceEntryReference,
} from "./contracts.js";
import { recommendationPolicy } from "./recommendation.js";

function sourceDigest(input: SnapshotInput): string {
  return sha256(canonicalJson(input.snapshot));
}

function compareReference(
  left: SourceEntryReference,
  right: SourceEntryReference,
): number {
  return (
    compareText(left.snapshotId, right.snapshotId) ||
    left.entryIndex - right.entryIndex
  );
}

function componentIdentity(
  platform: string,
  key: string,
  component: CatalogComponent,
): string {
  return `${platform}\u0000${key}\u0000${component.component}\u0000${component.coordinate}`;
}

function catalogPath(outputRoot: string, path: string): string {
  return `${outputRoot}/${path}`;
}

function shardPath(
  outputRoot: string,
  platform: string,
  key: string,
  digest: string,
): string {
  const safeKey = key.replaceAll(/[^A-Za-z0-9._-]/gu, "_");
  return catalogPath(
    outputRoot,
    `platforms/${platform}/${safeKey}.${digest}.json`,
  );
}

export function buildCatalog(input: CatalogBuildInput): CatalogBuildResult {
  if (input.snapshots.length === 0) {
    throw new Error("catalog generation requires at least one source snapshot");
  }
  const outputRoot = input.outputRoot ?? "catalog";
  if (!/^catalog(?:\/[a-zA-Z0-9._-]+)*$/u.test(outputRoot)) {
    throw new Error(
      "catalog output root must be a relative directory under catalog",
    );
  }
  const sourceDocuments = [...input.snapshots]
    .map((snapshot) => ({ input: snapshot, digest: sourceDigest(snapshot) }))
    .sort((left, right) =>
      compareText(
        left.input.snapshot.snapshotId,
        right.input.snapshot.snapshotId,
      ),
    );
  const seenSnapshots = new Set<string>();
  for (const { input: snapshot } of sourceDocuments) {
    if (seenSnapshots.has(snapshot.snapshot.snapshotId)) {
      throw new Error(
        `catalog generation repeats snapshot ${snapshot.snapshot.snapshotId}`,
      );
    }
    seenSnapshots.add(snapshot.snapshot.snapshotId);
  }
  const sourceSnapshots: SnapshotReference[] = sourceDocuments.map(
    ({ input: snapshot, digest }) => ({
      id: snapshot.snapshot.snapshotId,
      digest,
      path: snapshot.path,
    }),
  );
  const catalogId = `catalog.${sha256(
    canonicalJson({
      sourceSnapshots,
      categoryByPlatform: input.categoryByPlatform,
      keyKindByPlatform: input.keyKindByPlatform,
      recommendationPolicy,
      coverageMappingVersion: 1,
    }),
  ).slice(0, 24)}`;

  const grouped = new Map<string, CatalogShard>();
  const componentByIdentity = new Map<string, CatalogComponent>();
  for (const { input: snapshot } of sourceDocuments) {
    snapshot.snapshot.entries.forEach((entry, entryIndex) => {
      const category = input.categoryByPlatform[entry.platform];
      const keyKind =
        entry.compatibility === "unresolved"
          ? "unresolved"
          : entry.catalogKey === "all"
            ? "global"
            : input.keyKindByPlatform[entry.platform];
      if (!category || !keyKind) {
        throw new Error(
          `catalog generation has no category or key kind for ${entry.platform}`,
        );
      }
      const groupKey = `${entry.platform}\u0000${entry.catalogKey}`;
      let shard = grouped.get(groupKey);
      if (!shard) {
        shard = {
          $schema: "urn:mcgen:schema:catalog:1",
          schemaVersion: 1,
          id: "pending",
          catalogId,
          platform: entry.platform,
          category,
          keyKind,
          key: entry.catalogKey,
          sourceSnapshots: [],
          components: [],
          edges: [],
          blockers: [],
        };
        grouped.set(groupKey, shard);
      }
      if (!shard.sourceSnapshots.includes(snapshot.snapshot.snapshotId)) {
        shard.sourceSnapshots.push(snapshot.snapshot.snapshotId);
      }
      const reference: SourceEntryReference = {
        snapshotId: snapshot.snapshot.snapshotId,
        entryIndex,
        sourceIndexes: [...entry.sourceIndexes].sort(
          (left, right) => left - right,
        ),
      };
      const candidate: CatalogComponent = {
        id: "pending",
        component: entry.component,
        version: entry.version,
        coordinate: entry.coordinate,
        channel: entry.channel,
        compatibility: entry.compatibility ?? "declared",
        status: "discovered",
        sourceEntries: [reference],
      };
      const identity = componentIdentity(
        entry.platform,
        entry.catalogKey,
        candidate,
      );
      const known = componentByIdentity.get(identity);
      if (known) {
        known.sourceEntries.push(reference);
        return;
      }
      componentByIdentity.set(identity, candidate);
      shard.components.push(candidate);
    });
  }

  const shards: { path: string; document: CatalogShard }[] = [];
  for (const shard of grouped.values()) {
    shard.sourceSnapshots.sort(compareText);
    shard.components.sort(
      (left, right) =>
        compareText(left.component, right.component) ||
        compareText(left.version, right.version) ||
        compareText(left.coordinate, right.coordinate),
    );
    for (const component of shard.components) {
      component.sourceEntries.sort(compareReference);
      component.id = `component.${shard.platform}.${sha256(
        canonicalJson({
          key: shard.key,
          component: component.component,
          version: component.version,
          coordinate: component.coordinate,
        }),
      ).slice(0, 24)}`;
      if (shard.keyKind !== "global" && shard.keyKind !== "unresolved") {
        const targetId = `target.${shard.platform}.${sha256(
          canonicalJson({ key: shard.key }),
        ).slice(0, 24)}`;
        const edge: CatalogEdge = {
          kind: "targets",
          from: targetId,
          to: component.id,
          confidence: "published",
          sourceEntries: component.sourceEntries,
        };
        shard.edges.push(edge);
      }
    }
    shard.edges.sort(
      (left, right) =>
        compareText(left.from, right.from) || compareText(left.to, right.to),
    );
    shard.id = `catalog.${shard.platform}.${sha256(
      canonicalJson({
        catalogId: shard.catalogId,
        platform: shard.platform,
        key: shard.key,
        components: shard.components,
        edges: shard.edges,
      }),
    ).slice(0, 24)}`;
    const digest = sha256(canonicalJson(shard));
    shards.push({
      path: shardPath(outputRoot, shard.platform, shard.key, digest),
      document: shard,
    });
  }
  shards.sort((left, right) => compareText(left.path, right.path));

  const platformIndexes: CatalogPlatformIndex[] = [];
  for (const platform of [
    ...new Set(shards.map(({ document }) => document.platform)),
  ].sort(compareText)) {
    const documents = shards.filter(
      ({ document }) => document.platform === platform,
    );
    if (documents.length === 0) {
      throw new Error(`catalog index has no shards for ${platform}`);
    }
    const platformIndex: CatalogPlatformIndex = {
      $schema: "urn:mcgen:schema:catalog-platform-index:1",
      schemaVersion: 1,
      id: `catalog-platform.${platform}.${sha256(
        canonicalJson({
          catalogId,
          platform,
        }),
      ).slice(0, 24)}`,
      catalogId,
      platform,
      shards: documents
        .map(({ path, document }) => ({
          key: document.key,
          id: document.id,
          path,
          sha256: sha256(canonicalJson(document)),
          bytes: Buffer.byteLength(canonicalJson(document)),
          sourceSnapshots: document.sourceSnapshots,
        }))
        .sort((left, right) => compareText(left.key, right.key)),
    };
    platformIndexes.push(platformIndex);
  }
  const coverage = buildCoverageReport(
    catalogId,
    sourceDocuments,
    shards.map(({ document }) => document),
    input.coverageEvidence,
  );
  const coveragePath = catalogPath(outputRoot, "coverage.json");
  const policyPath = catalogPath(outputRoot, "recommendation-policy.json");
  const index = {
    $schema: "urn:mcgen:schema:catalog-index:1" as const,
    schemaVersion: 1 as const,
    id: catalogId,
    sourceSnapshots,
    recommendationPolicy: {
      path: policyPath,
      sha256: sha256(canonicalJson(recommendationPolicy)),
    },
    platforms: platformIndexes
      .map((platformIndex) => ({
        platform: platformIndex.platform,
        path: catalogPath(
          outputRoot,
          `platforms/${platformIndex.platform}/index.json`,
        ),
        sha256: sha256(canonicalJson(platformIndex)),
      }))
      .sort((left, right) => compareText(left.platform, right.platform)),
    coverage: {
      path: coveragePath,
      sha256: sha256(canonicalJson(coverage)),
    },
  };
  return {
    index,
    policy: recommendationPolicy,
    platformIndexes,
    shards,
    coverage,
  };
}
