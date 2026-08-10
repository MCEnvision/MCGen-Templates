import { canonicalJson, compareText } from "../canonical-json.js";
import { sha256 } from "../digest.js";
import type {
  CatalogBlocker,
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

function rejectionPlatform(input: SnapshotInput): string {
  const platforms = [
    ...new Set(input.snapshot.entries.map((entry) => entry.platform)),
  ];
  return platforms.length === 1
    ? (platforms[0] ?? input.snapshot.adapter.id)
    : input.snapshot.adapter.id;
}

function rejectionBlocker(
  input: SnapshotInput,
  rejectedIndex: number,
): CatalogBlocker {
  const rejected = input.snapshot.rejected[rejectedIndex];
  if (!rejected) {
    throw new Error(
      `coverage references missing rejected record ${input.snapshot.snapshotId}:${rejectedIndex}`,
    );
  }
  return {
    id: `blocker.${rejectionPlatform(input)}.${sha256(
      canonicalJson({
        snapshotId: input.snapshot.snapshotId,
        rejectedIndex,
        sourceIndex: rejected.sourceIndex,
        value: rejected.value,
        reason: rejected.reason,
      }),
    ).slice(0, 24)}`,
    subject: `source snapshot ${input.snapshot.snapshotId} rejected ${rejected.value}`,
    reason: rejected.reason,
    evidence: [
      `snapshot ${input.snapshot.snapshotId}`,
      `rejected record ${rejectedIndex}`,
      `source ${rejected.sourceIndex}`,
    ],
    rejectedEntries: [
      {
        snapshotId: input.snapshot.snapshotId,
        rejectedIndex,
        sourceIndex: rejected.sourceIndex,
      },
    ],
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
        rejected: 0,
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
    input.snapshot.rejected.forEach((_, rejectedIndex) => {
      const platformName = rejectionPlatform(input);
      const platform = platforms.get(platformName) ?? {
        platform: platformName,
        discovered: 0,
        represented: 0,
        rejected: 0,
        statuses: {},
        entries: [],
        blockers: [],
        unexplainedGaps: [],
      };
      platform.rejected += 1;
      platform.blockers.push(rejectionBlocker(input, rejectedIndex));
      platforms.set(platformName, platform);
    });
  }

  return {
    $schema: "urn:mcgen:schema:coverage-report:1",
    schemaVersion: 1,
    rejectionAccountingVersion: 1,
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
