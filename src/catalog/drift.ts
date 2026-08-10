import { canonicalJson, compareText } from "../canonical-json.js";
import { sha256 } from "../digest.js";
import type { SnapshotInput, CatalogDriftReport } from "./contracts.js";

function entryIdentity(
  platform: string,
  component: string,
  catalogKey: string,
  coordinate: string,
): string {
  return `${platform}\u0000${component}\u0000${catalogKey}\u0000${coordinate}`;
}

function snapshotDigest(input: SnapshotInput): string {
  return sha256(canonicalJson(input.snapshot));
}

function entrySet(inputs: readonly SnapshotInput[]): Set<string> {
  const entries = new Set<string>();
  for (const input of inputs) {
    for (const entry of input.snapshot.entries) {
      entries.add(
        entryIdentity(
          entry.platform,
          entry.component,
          entry.catalogKey,
          entry.coordinate,
        ),
      );
    }
  }
  return entries;
}

function sourceDigests(inputs: readonly SnapshotInput[]): Map<string, string> {
  const digests = new Map<string, string>();
  for (const input of inputs) {
    input.snapshot.sources.forEach((source, index) => {
      const sourceId =
        source.sourceId ?? `${input.snapshot.snapshotId}:${index}`;
      digests.set(sourceId, source.sha256);
    });
  }
  return digests;
}

export function buildCatalogDriftReport(
  baseline: readonly SnapshotInput[],
  candidate: readonly SnapshotInput[],
): CatalogDriftReport {
  if (baseline.length === 0 || candidate.length === 0) {
    throw new Error("catalog drift requires baseline and candidate snapshots");
  }
  const previousEntries = entrySet(baseline);
  const candidateEntries = entrySet(candidate);
  const added = [...candidateEntries]
    .filter((entry) => !previousEntries.has(entry))
    .sort(compareText);
  const retained = [...candidateEntries]
    .filter((entry) => previousEntries.has(entry))
    .sort(compareText);
  const removed = [...previousEntries]
    .filter((entry) => !candidateEntries.has(entry))
    .sort(compareText);
  const previousSources = sourceDigests(baseline);
  const candidateSources = sourceDigests(candidate);
  const changedSources = [...candidateSources]
    .filter(([sourceId, digest]) => previousSources.get(sourceId) !== digest)
    .map(([sourceId, candidateDigest]) => ({
      sourceId,
      previousDigest: previousSources.get(sourceId) ?? "0".repeat(64),
      candidateDigest,
    }))
    .sort((left, right) => compareText(left.sourceId, right.sourceId));
  const references = (inputs: readonly SnapshotInput[]) =>
    [...inputs]
      .map((input) => ({
        id: input.snapshot.snapshotId,
        digest: snapshotDigest(input),
      }))
      .sort((left, right) => compareText(left.id, right.id));
  return {
    $schema: "urn:mcgen:schema:catalog-drift-report:1",
    schemaVersion: 1,
    baseline: references(baseline),
    candidate: references(candidate),
    added,
    retained,
    removed,
    changedSources,
    requiresReview: removed.length > 0 || changedSources.length > 0,
  };
}
