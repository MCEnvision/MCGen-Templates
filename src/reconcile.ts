import { compareText } from "./canonical-json.js";
import type { SnapshotEntry, SourceSnapshot } from "./contracts.js";

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

function entriesByCoordinate(
  snapshot: SourceSnapshot,
): ReadonlyMap<string, SnapshotEntry> {
  const entries = new Map<string, SnapshotEntry>();
  for (const entry of snapshot.entries) {
    if (entries.has(entry.coordinate)) {
      throw new Error(
        `snapshot ${snapshot.snapshotId} repeats coordinate ${entry.coordinate}`,
      );
    }
    entries.set(entry.coordinate, entry);
  }
  return entries;
}

function sourceDigests(snapshot: SourceSnapshot): ReadonlyMap<string, string> {
  const sources = new Map<string, string>();
  for (const source of snapshot.sources) {
    const sourceId = source.sourceId;
    if (!sourceId) continue;
    if (sources.has(sourceId)) {
      throw new Error(
        `snapshot ${snapshot.snapshotId} repeats source ${sourceId}`,
      );
    }
    sources.set(sourceId, source.sha256);
  }
  return sources;
}

export function reconcileSnapshots(
  previous: SourceSnapshot,
  candidate: SourceSnapshot,
): SnapshotReconciliation {
  if (previous.adapter.id !== candidate.adapter.id) {
    throw new Error("snapshot reconciliation requires the same adapter id");
  }
  const previousEntries = entriesByCoordinate(previous);
  const candidateEntries = entriesByCoordinate(candidate);
  const addedCoordinates = [...candidateEntries.keys()]
    .filter((coordinate) => !previousEntries.has(coordinate))
    .sort(compareText);
  const removedCoordinates = [...previousEntries.keys()]
    .filter((coordinate) => !candidateEntries.has(coordinate))
    .sort(compareText);
  const previousSources = sourceDigests(previous);
  const candidateSources = sourceDigests(candidate);
  const changedSources = [...previousSources.entries()]
    .flatMap(([sourceId, previousSha256]) => {
      const candidateSha256 = candidateSources.get(sourceId);
      return candidateSha256 && candidateSha256 !== previousSha256
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
