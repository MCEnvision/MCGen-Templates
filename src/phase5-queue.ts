import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";

export const queuePlanSchema = "urn:mcgen:schema:queue-plan:1" as const;

export type VerificationQueue =
  | "changed-boundaries"
  | "new-tuples"
  | "invalidation"
  | "scheduled-audit"
  | "transient-recovery";

export type QueueEvent = {
  queue: VerificationQueue;
  subject: string;
  changedPaths: readonly string[];
  tupleIds: readonly string[];
  sourceDigest?: string;
  createdAt: string;
};

export type QueuePlan = {
  $schema: typeof queuePlanSchema;
  schemaVersion: 1;
  kind: "queue-plan";
  queue: VerificationQueue;
  eventDigest: string;
  cancelKey: string;
  shardCount: number;
  shardIndex: number;
  tupleIds: readonly string[];
  maxAttempts: number;
  timeoutMinutes: number;
};

const limits: Record<
  VerificationQueue,
  { maxAttempts: number; timeoutMinutes: number }
> = {
  "changed-boundaries": { maxAttempts: 1, timeoutMinutes: 30 },
  "new-tuples": { maxAttempts: 1, timeoutMinutes: 30 },
  invalidation: { maxAttempts: 1, timeoutMinutes: 30 },
  "scheduled-audit": { maxAttempts: 2, timeoutMinutes: 60 },
  "transient-recovery": { maxAttempts: 3, timeoutMinutes: 30 },
};

export function buildQueuePlan(input: {
  event: QueueEvent;
  shardCount: number;
  shardIndex: number;
}): QueuePlan {
  if (!(input.event.queue in limits))
    throw new Error(`queue type is unsupported ${input.event.queue}`);
  if (!Number.isInteger(input.shardCount) || input.shardCount < 1)
    throw new Error("queue shard count must be positive");
  if (
    !Number.isInteger(input.shardIndex) ||
    input.shardIndex < 0 ||
    input.shardIndex >= input.shardCount
  )
    throw new Error("queue shard index is invalid");
  if (!input.event.subject || /[\s/\\]/u.test(input.event.subject))
    throw new Error("queue subject must be a stable identifier");
  if (input.event.changedPaths.some((path) => typeof path !== "string"))
    throw new Error("queue changed paths must be strings");
  const tupleIds = [...new Set(input.event.tupleIds)].sort(compareText);
  if (tupleIds.some((tupleId) => !/^[a-f0-9]{64}$/u.test(tupleId)))
    throw new Error("queue tuple ids must be lowercase sha256 digests");
  if (tupleIds.length > 100_000)
    throw new Error("queue contains too many tuple ids");
  const event = {
    ...input.event,
    changedPaths: [...new Set(input.event.changedPaths)].sort(compareText),
    tupleIds,
  };
  const eventDigest = sha256(canonicalJson(event));
  const selected = tupleIds.filter(
    (tupleId) =>
      Number.parseInt(tupleId.slice(0, 8), 16) % input.shardCount ===
      input.shardIndex,
  );
  const policy = limits[input.event.queue];
  return {
    $schema: queuePlanSchema,
    schemaVersion: 1,
    kind: "queue-plan",
    queue: input.event.queue,
    eventDigest,
    cancelKey: `phase5-${input.event.queue}-${input.event.subject}-${input.shardIndex}`,
    shardCount: input.shardCount,
    shardIndex: input.shardIndex,
    tupleIds: selected,
    maxAttempts: policy.maxAttempts,
    timeoutMinutes: policy.timeoutMinutes,
  };
}

export function queueConcurrencyGroup(plan: QueuePlan): string {
  return `${plan.cancelKey}-${plan.shardIndex}`;
}
