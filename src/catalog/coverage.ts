import { canonicalJson, compareText } from "../canonical-json.js";
import { sha256 } from "../digest.js";
import type {
  CatalogBlocker,
  CatalogComponent,
  CatalogShard,
  CoverageEvidenceInput,
  CoverageEvidenceReference,
  CoveragePlatform,
  CoverageReport,
  SnapshotInput,
  SnapshotReference,
} from "./contracts.js";

const digestPattern = /^[a-f0-9]{64}$/u;

type CoverageComponent = {
  shardId: string;
  shardPlatform: string;
  shardKey: string;
  component: CatalogComponent;
};

function entryKey(snapshotId: string, entryIndex: number): string {
  return `${snapshotId}:${entryIndex}`;
}

function evidenceKey(
  platform: string,
  catalogKey: string,
  coordinate: string,
): string {
  return `${platform}\u0000${catalogKey}\u0000${coordinate}`;
}

function coordinateEvidenceKey(catalogKey: string, coordinate: string): string {
  return evidenceKey("*", catalogKey, coordinate);
}

function versionEvidenceKey(catalogKey: string, version: string): string {
  return evidenceKey("version", catalogKey, version);
}

function familyEvidenceKey(
  family: string,
  catalogKey: string,
  coordinate: string,
): string {
  return evidenceKey(family, catalogKey, coordinate);
}

function validateEvidenceInput(input: CoverageEvidenceInput): void {
  if (!digestPattern.test(input.tupleId))
    throw new Error("coverage evidence tuple id must be a sha256 digest");
  if (!digestPattern.test(input.evidenceDigest))
    throw new Error("coverage evidence digest must be a sha256 digest");
  if (
    !input.evidencePath.startsWith("verification/phase5/evidence/") ||
    !input.evidencePath.endsWith(".json") ||
    input.evidencePath.includes("..")
  ) {
    throw new Error("coverage evidence path is outside phase 5 evidence");
  }
  if (
    typeof input.family !== "string" ||
    input.family.length === 0 ||
    typeof input.catalogKey !== "string" ||
    input.catalogKey.length === 0 ||
    typeof input.components !== "object" ||
    Array.isArray(input.components) ||
    Object.keys(input.components).length === 0 ||
    Object.entries(input.components).some(
      ([platform, coordinate]) =>
        platform.length === 0 ||
        typeof coordinate !== "string" ||
        coordinate.length === 0,
    )
  )
    throw new Error(
      "coverage evidence must identify a catalog key and component",
    );
  const status = input.status as string;
  if (status !== "verified" && status !== "legacy-verified")
    throw new Error("coverage evidence status is not exact");
}

function exactEvidenceByComponent(
  inputs: readonly CoverageEvidenceInput[],
): Map<string, CoverageEvidenceReference[]> {
  const result = new Map<string, CoverageEvidenceReference[]>();
  const orderedInputs = [...inputs].sort(
    (left, right) =>
      compareText(left.catalogKey, right.catalogKey) ||
      compareText(left.evidencePath, right.evidencePath) ||
      compareText(left.tupleId, right.tupleId) ||
      compareText(left.evidenceDigest, right.evidenceDigest) ||
      compareText(left.status, right.status) ||
      compareText(
        canonicalJson(left.components),
        canonicalJson(right.components),
      ),
  );
  for (const input of orderedInputs) {
    validateEvidenceInput(input);
    const reference: CoverageEvidenceReference = {
      tupleId: input.tupleId,
      evidencePath: input.evidencePath,
      evidenceDigest: input.evidenceDigest,
      status: input.status,
    };
    for (const [platform, coordinate] of Object.entries(input.components).sort(
      ([left], [right]) => compareText(left, right),
    )) {
      const key = evidenceKey(platform, input.catalogKey, coordinate);
      const version = coordinate.slice(coordinate.lastIndexOf(":") + 1);
      for (const lookupKey of [
        key,
        coordinateEvidenceKey(input.catalogKey, coordinate),
        versionEvidenceKey(input.catalogKey, coordinate),
        versionEvidenceKey(input.catalogKey, version),
        familyEvidenceKey(input.family, input.catalogKey, coordinate),
        familyEvidenceKey(input.family, input.catalogKey, version),
      ]) {
        const references = result.get(lookupKey) ?? [];
        if (
          !references.some(
            (candidate) => candidate.tupleId === reference.tupleId,
          )
        )
          references.push(reference);
        references.sort((left, right) =>
          left.tupleId.localeCompare(right.tupleId),
        );
        result.set(lookupKey, references);
      }
    }
  }
  return result;
}

function componentBlocker(
  catalogId: string,
  component: CoverageComponent,
): CatalogBlocker {
  const { component: value } = component;
  const identity = {
    catalogId,
    componentId: value.id,
    platform: component.shardPlatform,
    key: component.shardKey,
    coordinate: value.coordinate,
  };
  return {
    id: `blocker.component.${component.shardPlatform}.${sha256(
      canonicalJson(identity),
    ).slice(0, 24)}`,
    subject: `catalog component ${value.id}`,
    reason:
      "exact tuple evidence is unavailable for generation, compilation, packaging, and artifact inspection",
    evidence: [
      `component ${value.id}`,
      `catalog key ${component.shardKey}`,
      `coordinate ${value.coordinate}`,
      "phase 5 exact tuple evidence required",
    ],
  };
}

function addBlocker(platform: CoveragePlatform, blocker: CatalogBlocker): void {
  if (!platform.blockers.some((candidate) => candidate.id === blocker.id))
    platform.blockers.push(blocker);
}

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
  coverageEvidence: readonly CoverageEvidenceInput[] = [],
): CoverageReport {
  const shardByEntry = new Map<string, CatalogShard>();
  const componentByEntry = new Map<string, CoverageComponent>();
  for (const shard of shards) {
    for (const component of shard.components) {
      for (const reference of component.sourceEntries) {
        const key = entryKey(reference.snapshotId, reference.entryIndex);
        const current = componentByEntry.get(key);
        const mapped = {
          shardId: shard.id,
          shardPlatform: shard.platform,
          shardKey: shard.key,
          component,
        };
        if (current && current.component.id !== component.id)
          throw new Error(
            `coverage source entry maps to multiple components ${key}`,
          );
        shardByEntry.set(key, shard);
        componentByEntry.set(key, mapped);
      }
    }
  }
  const evidenceByComponent = exactEvidenceByComponent(coverageEvidence);

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
      const mapped = componentByEntry.get(
        entryKey(input.snapshot.snapshotId, entryIndex),
      );
      if (shard && mapped) {
        platform.represented += 1;
        const version = entry.coordinate.slice(
          entry.coordinate.lastIndexOf(":") + 1,
        );
        const evidence =
          evidenceByComponent.get(
            evidenceKey(shard.platform, entry.catalogKey, entry.coordinate),
          ) ??
          evidenceByComponent.get(
            familyEvidenceKey(
              entry.platform,
              entry.catalogKey,
              entry.coordinate,
            ),
          ) ??
          evidenceByComponent.get(
            familyEvidenceKey(entry.platform, entry.catalogKey, version),
          );
        if (evidence && evidence.length > 0) {
          const verificationStatus = evidence.some(
            (reference) => reference.status === "verified",
          )
            ? "verified"
            : "legacy-verified";
          platform.statuses[verificationStatus] =
            (platform.statuses[verificationStatus] ?? 0) + 1;
          platform.entries.push({
            snapshotId: input.snapshot.snapshotId,
            entryIndex,
            disposition: "represented",
            shardId: shard.id,
            componentId: mapped.component.id,
            verificationStatus,
            resolution: {
              kind: "exact-evidence",
              evidence,
            },
          });
        } else {
          const blocker = componentBlocker(catalogId, mapped);
          addBlocker(platform, blocker);
          platform.statuses["blocked"] =
            (platform.statuses["blocked"] ?? 0) + 1;
          platform.entries.push({
            snapshotId: input.snapshot.snapshotId,
            entryIndex,
            disposition: "represented",
            shardId: shard.id,
            componentId: mapped.component.id,
            verificationStatus: "blocked",
            resolution: { kind: "blocker", blockerId: blocker.id },
          });
        }
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
    coverageMappingVersion: 1,
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
