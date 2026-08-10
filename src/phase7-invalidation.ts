import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import { validateEvidenceRecord } from "./evidence.js";
import { buildQueuePlan, type QueuePlan } from "./phase5-queue.js";
import type { TupleEvidenceRecord } from "./phase5-contracts.js";
import type { MonitorRun, MonitorSourceChange } from "./phase7-monitor.js";

export const invalidationPlanSchema =
  "urn:mcgen:schema:invalidation-plan:1" as const;

export type InvalidationEvidence = {
  evidenceId: string;
  status: TupleEvidenceRecord["status"];
  matchedSourceIds: string[];
  matchedDigests: string[];
  reasons: string[];
};

export type InvalidationPlan = {
  $schema: typeof invalidationPlanSchema;
  schemaVersion: 1;
  kind: "invalidation-plan";
  planId: string;
  digest: string;
  monitorRunId: string;
  generatedAt: string;
  sourceFamily: string;
  status: "no-change" | "invalidated" | "changed-no-evidence";
  changedSources: (MonitorSourceChange & { evidenceCount: number })[];
  evidence: InvalidationEvidence[];
  tupleIds: string[];
  queuePlans: QueuePlan[];
  summary: {
    changedSourceCount: number;
    invalidatedEvidenceCount: number;
    invalidatedTupleCount: number;
    queueShardCount: number;
  };
};

const digestPattern = /^[a-f0-9]{64}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function requireDigest(value: string, label: string): void {
  if (!digestPattern.test(value)) throw new Error(`${label} is invalid`);
}

function requireIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) throw new Error(`${label} is invalid`);
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

function changedSources(
  monitor: Pick<MonitorRun, "changedSources">,
): MonitorSourceChange[] {
  const seen = new Set<string>();
  return [...monitor.changedSources]
    .map((change) => {
      requireIdentifier(change.sourceId, "invalidation source id");
      requireDigest(change.previousDigest, "invalidation previous digest");
      requireDigest(change.candidateDigest, "invalidation candidate digest");
      if (change.previousDigest === change.candidateDigest) {
        throw new Error(
          `invalidation source ${change.sourceId} has no digest change`,
        );
      }
      if (seen.has(change.sourceId)) {
        throw new Error(`invalidation source repeats ${change.sourceId}`);
      }
      seen.add(change.sourceId);
      return change;
    })
    .sort((left, right) => compareText(left.sourceId, right.sourceId));
}

function evidenceMatches(
  record: TupleEvidenceRecord,
  changes: readonly MonitorSourceChange[],
): InvalidationEvidence | undefined {
  const failures = validateEvidenceRecord(record);
  if (failures.length) {
    throw new Error(
      `evidence ${record.key.digest} is invalid\n${failures.join("\n")}`,
    );
  }
  const matches = changes.filter((change) =>
    record.invalidation.sourceDigests.includes(change.previousDigest),
  );
  if (!matches.length) return undefined;
  const matchedSourceIds = sorted(matches.map((match) => match.sourceId));
  const matchedDigests = sorted(matches.map((match) => match.previousDigest));
  return {
    evidenceId: record.key.digest,
    status: record.status,
    matchedSourceIds,
    matchedDigests,
    reasons: matchedSourceIds.map(
      (sourceId) => `source evidence changed for ${sourceId}`,
    ),
  };
}

export function buildInvalidationPlan(input: {
  monitor: Pick<
    MonitorRun,
    "runId" | "generatedAt" | "sourceFamily" | "changedSources"
  >;
  evidence: readonly TupleEvidenceRecord[];
  shardCount: number;
  changedPaths?: readonly string[];
}): InvalidationPlan {
  requireDigest(input.monitor.runId, "invalidation monitor run id");
  requireIdentifier(input.monitor.sourceFamily, "invalidation source family");
  if (
    !Number.isInteger(input.shardCount) ||
    input.shardCount < 1 ||
    input.shardCount > 256
  ) {
    throw new Error("invalidation shard count must be between 1 and 256");
  }
  const changes = changedSources(input.monitor);
  const seenEvidence = new Set<string>();
  const evidence = input.evidence
    .map((record) => {
      requireDigest(record.key.digest, "invalidation evidence id");
      if (seenEvidence.has(record.key.digest)) {
        throw new Error(`invalidation evidence repeats ${record.key.digest}`);
      }
      seenEvidence.add(record.key.digest);
      return evidenceMatches(record, changes);
    })
    .filter((record): record is InvalidationEvidence => record !== undefined)
    .sort((left, right) => compareText(left.evidenceId, right.evidenceId));
  const tupleIds = sorted(evidence.map((record) => record.evidenceId));
  const status: InvalidationPlan["status"] =
    changes.length === 0
      ? "no-change"
      : evidence.length > 0
        ? "invalidated"
        : "changed-no-evidence";
  const queuePlans: QueuePlan[] = [];
  if (tupleIds.length > 0) {
    const changedPaths = sorted(input.changedPaths ?? []);
    const sourceDigest =
      changes.length === 1 ? changes[0]?.candidateDigest : undefined;
    for (let shardIndex = 0; shardIndex < input.shardCount; shardIndex += 1) {
      queuePlans.push(
        buildQueuePlan({
          event: {
            queue: "invalidation",
            subject: input.monitor.sourceFamily,
            changedPaths,
            tupleIds,
            ...(sourceDigest ? { sourceDigest } : {}),
            createdAt: input.monitor.generatedAt,
          },
          shardCount: input.shardCount,
          shardIndex,
        }),
      );
    }
  }
  const changedWithCounts = changes.map((change) => ({
    ...change,
    evidenceCount: evidence.filter((record) =>
      record.matchedSourceIds.includes(change.sourceId),
    ).length,
  }));
  const withoutIdentity = {
    $schema: invalidationPlanSchema,
    schemaVersion: 1 as const,
    kind: "invalidation-plan" as const,
    monitorRunId: input.monitor.runId,
    generatedAt: input.monitor.generatedAt,
    sourceFamily: input.monitor.sourceFamily,
    status,
    changedSources: changedWithCounts,
    evidence,
    tupleIds,
    queuePlans,
    summary: {
      changedSourceCount: changes.length,
      invalidatedEvidenceCount: evidence.length,
      invalidatedTupleCount: tupleIds.length,
      queueShardCount: queuePlans.length,
    },
  };
  const identity = { ...withoutIdentity };
  delete (identity as { generatedAt?: string }).generatedAt;
  delete (identity as { queuePlans?: QueuePlan[] }).queuePlans;
  const planId = sha256(canonicalJson(identity));
  const withPlanId = { ...withoutIdentity, planId };
  return {
    ...withPlanId,
    digest: sha256(canonicalJson(withPlanId)),
  };
}
