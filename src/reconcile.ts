import { canonicalJson, compareText } from "./canonical-json.js";
import type { SourceSnapshot } from "./contracts.js";
import { sha256 } from "./digest.js";

export type SnapshotReconciliation = {
  previousSnapshotId: string;
  candidateSnapshotId: string;
  addedCoordinates: string[];
  removedCoordinates: string[];
  changedSources: {
    sourceId: string;
    previousSha256: string;
    candidateSha256: string;
  }[];
  requiresReview: boolean;
};

function entryIdentity(entry: SourceSnapshot["entries"][number]): string {
  return [
    entry.platform,
    entry.component,
    entry.catalogKey,
    entry.coordinate,
  ].join("\u0000");
}

function entriesByIdentity(
  snapshot: SourceSnapshot,
): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  const records = new Set<string>();
  for (const entry of snapshot.entries) {
    const record = canonicalJson(entry);
    if (records.has(record)) {
      throw new Error(
        `snapshot ${snapshot.snapshotId} repeats exact entry record ${entry.coordinate}`,
      );
    }
    records.add(record);
    entries.set(entryIdentity(entry), entry.coordinate);
  }
  return entries;
}

function sourceDigests(
  snapshot: SourceSnapshot,
): ReadonlyMap<string, readonly string[]> {
  const sources = new Map<string, Set<string>>();
  const records = new Set<string>();
  for (const source of snapshot.sources) {
    const record = canonicalJson(source);
    if (records.has(record)) {
      throw new Error(
        `snapshot ${snapshot.snapshotId} repeats exact source record ${source.sourceId ?? "without source id"}`,
      );
    }
    records.add(record);
    const sourceId = source.sourceId;
    if (!sourceId) continue;
    const digests = sources.get(sourceId) ?? new Set<string>();
    digests.add(source.sha256);
    sources.set(sourceId, digests);
  }
  return new Map(
    [...sources.entries()].map(([sourceId, digests]) => [
      sourceId,
      [...digests].sort(compareText),
    ]),
  );
}

function sourceGroupDigest(digests: readonly string[]): string {
  const [digest] = digests;
  if (digests.length === 1 && digest !== undefined) return digest;
  return sha256(canonicalJson(digests));
}

export function reconcileSnapshots(
  previous: SourceSnapshot,
  candidate: SourceSnapshot,
): SnapshotReconciliation {
  if (previous.adapter.id !== candidate.adapter.id) {
    throw new Error("snapshot reconciliation requires the same adapter id");
  }
  const previousEntries = entriesByIdentity(previous);
  const candidateEntries = entriesByIdentity(candidate);
  const addedCoordinates = [
    ...new Set(
      [...candidateEntries.entries()]
        .filter(([identity]) => !previousEntries.has(identity))
        .map(([, coordinate]) => coordinate),
    ),
  ].sort(compareText);
  const removedCoordinates = [
    ...new Set(
      [...previousEntries.entries()]
        .filter(([identity]) => !candidateEntries.has(identity))
        .map(([, coordinate]) => coordinate),
    ),
  ].sort(compareText);
  const previousSources = sourceDigests(previous);
  const candidateSources = sourceDigests(candidate);
  const sourceIds = [
    ...new Set([...previousSources.keys(), ...candidateSources.keys()]),
  ].sort(compareText);
  const changedSources = sourceIds
    .flatMap((sourceId) => {
      const previousSha256 = sourceGroupDigest(
        previousSources.get(sourceId) ?? [],
      );
      const candidateSha256 = sourceGroupDigest(
        candidateSources.get(sourceId) ?? [],
      );
      return previousSha256 !== candidateSha256
        ? [{ sourceId, previousSha256, candidateSha256 }]
        : [];
    })
    .sort((left, right) => compareText(left.sourceId, right.sourceId));
  return {
    previousSnapshotId: previous.snapshotId,
    candidateSnapshotId: candidate.snapshotId,
    addedCoordinates,
    removedCoordinates,
    changedSources,
    requiresReview: removedCoordinates.length > 0 || changedSources.length > 0,
  };
}
