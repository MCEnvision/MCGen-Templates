import { compareText } from "../canonical-json.js";
import type {
  CatalogShard,
  CoveragePlatform,
  CoverageReport,
  SnapshotInput,
  SnapshotReference,
} from "./contracts.js";

function snapshotReference(
  input: SnapshotInput,
  digest: string,
): SnapshotReference & { entries: number; rejected: number } {
  return {
    id: input.snapshot.snapshotId,
    digest,
    path: input.path,
    entries: input.snapshot.entries.length,
    rejected: input.snapshot.rejected.length,
  };
}

export function buildCoverageReport(
  catalogId: string,
  snapshots: readonly { input: SnapshotInput; digest: string }[],
  shards: readonly CatalogShard[],
): CoverageReport {
  const shardByEntry = new Map<string, CatalogShard>();
  for (const shard of shards) {
    for (const component of shard.components) {
      for (const reference of component.sourceEntries) {
        shardByEntry.set(
          `${reference.snapshotId}:${reference.entryIndex}`,
          shard,
        );
      }
    }
  }

  const platforms = new Map<string, CoveragePlatform>();
  for (const { input } of snapshots) {
    input.snapshot.entries.forEach((entry, entryIndex) => {
      const shard = shardByEntry.get(
        `${input.snapshot.snapshotId}:${entryIndex}`,
      );
      const platform = platforms.get(entry.platform) ?? {
        platform: entry.platform,
        discovered: 0,
        represented: 0,
        statuses: {},
        entries: [],
        blockers: [],
        unexplainedGaps: [],
      };
      platform.discovered += 1;
      if (shard) {
        platform.represented += 1;
        platform.statuses["discovered"] =
          (platform.statuses["discovered"] ?? 0) + 1;
        platform.entries.push({
          snapshotId: input.snapshot.snapshotId,
          entryIndex,
          disposition: "represented",
          shardId: shard.id,
        });
      } else {
        platform.unexplainedGaps.push(
          `${input.snapshot.snapshotId}:${entryIndex} has no catalog shard or blocker`,
        );
      }
      platforms.set(entry.platform, platform);
    });
  }

  return {
    $schema: "urn:mcgen:schema:coverage-report:1",
    schemaVersion: 1,
    catalogId,
    sourceSnapshots: snapshots
      .map(({ input, digest }) => snapshotReference(input, digest))
      .sort((left, right) => compareText(left.id, right.id)),
    platforms: [...platforms.values()]
      .map((platform) => ({
        ...platform,
        entries: [...platform.entries].sort(
          (left, right) =>
            compareText(left.snapshotId, right.snapshotId) ||
            left.entryIndex - right.entryIndex,
        ),
        blockers: [...platform.blockers].sort((left, right) =>
          compareText(left.id, right.id),
        ),
        unexplainedGaps: [...platform.unexplainedGaps].sort(compareText),
      }))
      .sort((left, right) => compareText(left.platform, right.platform)),
  };
}
