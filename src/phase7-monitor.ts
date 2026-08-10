import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";

export const monitorRunSchema = "urn:mcgen:schema:monitor-run:1" as const;
export const quarantineRecordSchema =
  "urn:mcgen:schema:quarantine-record:1" as const;

export type MonitorOutcome =
  | "unchanged"
  | "additions"
  | "compatibility-boundary"
  | "source-unavailable"
  | "source-mutation"
  | "artifact-missing"
  | "artifact-mutated"
  | "repository-protocol-failure"
  | "unsupported-host-jdk"
  | "profile-mismatch"
  | "template-defect"
  | "upstream-defect"
  | "transient-network-failure"
  | "test-infrastructure-failure"
  | "empty-response"
  | "malformed-response"
  | "bulk-removal";

export type MonitorClassification =
  "no-change" | "additive" | "boundary" | "review" | "retry" | "quarantine";

export type SnapshotReference = { id: string; digest: string; path?: string };

export type MonitorSourceChange = {
  sourceId: string;
  previousDigest: string;
  candidateDigest: string;
};

export type MonitorSourceChangeInput =
  | MonitorSourceChange
  | {
      sourceId: string;
      previousSha256: string;
      candidateSha256: string;
    };

export type MonitorReconciliationInput = {
  addedCoordinates: readonly string[];
  removedCoordinates: readonly string[];
  changedSources: readonly MonitorSourceChangeInput[];
};

export type MonitorObservation = {
  sourceFamily: string;
  adapterId: string;
  generatedAt: string;
  baseline: SnapshotReference;
  candidate: SnapshotReference | null;
  outcome?: MonitorOutcome;
  addedCoordinates?: readonly string[];
  removedCoordinates?: readonly string[];
  changedSources?: readonly MonitorSourceChangeInput[];
  reconciliation?: MonitorReconciliationInput;
  affectedTuples?: readonly string[];
  attempt?: number;
  maxAttempts?: number;
  reasons?: readonly string[];
};

export type MonitorRetry = {
  attempt: number;
  maxAttempts: number;
  eligible: boolean;
  backoffSeconds: number[];
};

export type MonitorPolicy = {
  proposeCandidate: boolean;
  requiresPullRequest: boolean;
  preserveLastKnownGood: boolean;
  publicationBlocked: boolean;
};

export type MonitorRun = {
  $schema: typeof monitorRunSchema;
  schemaVersion: 1;
  kind: "monitor-run";
  runId: string;
  generatedAt: string;
  sourceFamily: string;
  adapterId: string;
  outcome: MonitorOutcome;
  classification: MonitorClassification;
  baseline: SnapshotReference;
  candidate: SnapshotReference | null;
  addedCoordinates: string[];
  removedCoordinates: string[];
  changedSources: MonitorSourceChange[];
  affectedTuples: string[];
  retry: MonitorRetry;
  policy: MonitorPolicy;
  reasons: string[];
  quarantineId?: string;
};

export type QuarantineRecord = {
  $schema: typeof quarantineRecordSchema;
  schemaVersion: 1;
  kind: "quarantine-record";
  quarantineId: string;
  createdAt: string;
  sourceFamily: string;
  adapterId: string;
  outcome: Exclude<
    MonitorOutcome,
    | "unchanged"
    | "additions"
    | "compatibility-boundary"
    | "source-unavailable"
    | "source-mutation"
    | "transient-network-failure"
    | "test-infrastructure-failure"
  >;
  baseline: SnapshotReference;
  candidate: SnapshotReference | null;
  affectedCoordinates: string[];
  affectedTuples: string[];
  preserveLastKnownGood: true;
  publicationBlocked: true;
  status: "open" | "resolved";
  recoverySteps: string[];
  reason: string;
  retryAfterSeconds?: number;
};

const allOutcomes: ReadonlySet<MonitorOutcome> = new Set([
  "unchanged",
  "additions",
  "compatibility-boundary",
  "source-unavailable",
  "source-mutation",
  "artifact-missing",
  "artifact-mutated",
  "repository-protocol-failure",
  "unsupported-host-jdk",
  "profile-mismatch",
  "template-defect",
  "upstream-defect",
  "transient-network-failure",
  "test-infrastructure-failure",
  "empty-response",
  "malformed-response",
  "bulk-removal",
]);

const retryableOutcomes: ReadonlySet<MonitorOutcome> = new Set([
  "source-unavailable",
  "transient-network-failure",
]);

const quarantineOutcomes: ReadonlySet<MonitorOutcome> = new Set([
  "artifact-missing",
  "artifact-mutated",
  "repository-protocol-failure",
  "unsupported-host-jdk",
  "profile-mismatch",
  "template-defect",
  "upstream-defect",
  "empty-response",
  "malformed-response",
  "bulk-removal",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireIdentifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value)) {
    throw new Error(`${label} must be a stable identifier`);
  }
}

function requireDigest(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase sha256 digest`);
  }
}

function requireTimestamp(value: string): void {
  if (!value.endsWith("Z") || Number.isNaN(Date.parse(value))) {
    throw new Error("monitor generatedAt must be an iso timestamp in utc");
  }
}

function requireSnapshot(value: SnapshotReference, label: string): void {
  if (!isRecord(value) || typeof value.id !== "string") {
    throw new Error(`${label} snapshot reference is invalid`);
  }
  requireIdentifier(value.id, `${label} snapshot id`);
  if (typeof value.digest !== "string") {
    throw new Error(`${label} snapshot digest is invalid`);
  }
  requireDigest(value.digest, `${label} snapshot digest`);
  if (
    value.path !== undefined &&
    !/^[a-zA-Z0-9._/-]+\.json$/u.test(value.path)
  ) {
    throw new Error(`${label} snapshot path is invalid`);
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function normalizedChanges(
  values: readonly MonitorSourceChangeInput[],
): MonitorSourceChange[] {
  const bySource = new Map<string, MonitorSourceChange>();
  for (const value of values) {
    if (!isRecord(value) || typeof value.sourceId !== "string") {
      throw new Error("monitor source change is invalid");
    }
    requireIdentifier(value.sourceId, "monitor source id");
    const previousDigest =
      "previousDigest" in value ? value.previousDigest : value.previousSha256;
    const candidateDigest =
      "candidateDigest" in value
        ? value.candidateDigest
        : value.candidateSha256;
    if (
      typeof previousDigest !== "string" ||
      typeof candidateDigest !== "string"
    ) {
      throw new Error(`monitor source change ${value.sourceId} has no digests`);
    }
    requireDigest(previousDigest, "monitor previous source digest");
    requireDigest(candidateDigest, "monitor candidate source digest");
    if (bySource.has(value.sourceId)) {
      throw new Error(`monitor source change repeats ${value.sourceId}`);
    }
    bySource.set(value.sourceId, {
      sourceId: value.sourceId,
      previousDigest,
      candidateDigest,
    });
  }
  return [...bySource.values()].sort((left, right) =>
    compareText(left.sourceId, right.sourceId),
  );
}

function inferredOutcome(input: MonitorObservation): MonitorOutcome {
  const additions = Math.max(
    input.addedCoordinates?.length ?? 0,
    input.reconciliation?.addedCoordinates.length ?? 0,
  );
  const removals = Math.max(
    input.removedCoordinates?.length ?? 0,
    input.reconciliation?.removedCoordinates.length ?? 0,
  );
  const changes = Math.max(
    input.changedSources?.length ?? 0,
    input.reconciliation?.changedSources.length ?? 0,
  );
  const candidateChanged =
    input.candidate !== null &&
    input.candidate.digest !== input.baseline.digest;
  if (input.outcome) {
    if (!allOutcomes.has(input.outcome)) {
      throw new Error(`unknown monitor outcome ${input.outcome}`);
    }
    if (
      input.outcome === "unchanged" &&
      (additions > 0 || removals > 0 || changes > 0 || candidateChanged)
    ) {
      throw new Error("unchanged monitor outcome contradicts observed deltas");
    }
    if (
      input.outcome === "additions" &&
      (additions === 0 || removals > 0 || changes > 0)
    ) {
      throw new Error("additions monitor outcome contradicts observed deltas");
    }
    if (input.outcome === "source-mutation" && changes === 0) {
      throw new Error("source mutation monitor outcome has no changed source");
    }
    if (input.outcome === "bulk-removal" && removals === 0) {
      throw new Error("bulk removal monitor outcome has no removed coordinate");
    }
    return input.outcome;
  }
  if (removals > 0) return "bulk-removal";
  if (changes > 0) return "source-mutation";
  if (additions > 0) return "additions";
  if (candidateChanged) return "source-mutation";
  return "unchanged";
}

export function isRetryableMonitorOutcome(outcome: MonitorOutcome): boolean {
  return retryableOutcomes.has(outcome);
}

export function isQuarantineRequired(outcome: MonitorOutcome): boolean {
  return quarantineOutcomes.has(outcome);
}

export function classifyMonitorEvent(input: {
  outcome: MonitorOutcome;
  attempt: number;
  maxAttempts: number;
  addedCoordinates?: readonly string[];
  removedCoordinates?: readonly string[];
  changedSources?: readonly MonitorSourceChange[];
}): MonitorClassification {
  if (!allOutcomes.has(input.outcome)) {
    throw new Error(`unknown monitor outcome ${input.outcome}`);
  }
  if (!Number.isInteger(input.attempt) || input.attempt < 0) {
    throw new Error("monitor retry attempt must be a nonnegative integer");
  }
  if (
    !Number.isInteger(input.maxAttempts) ||
    input.maxAttempts < 0 ||
    input.maxAttempts > 10 ||
    input.attempt > input.maxAttempts
  ) {
    throw new Error("monitor retry limit is invalid");
  }
  if (input.outcome === "unchanged") return "no-change";
  if (input.outcome === "additions") {
    if ((input.removedCoordinates?.length ?? 0) > 0) return "review";
    if ((input.changedSources?.length ?? 0) > 0) return "review";
    return "additive";
  }
  if (input.outcome === "compatibility-boundary") return "boundary";
  if (retryableOutcomes.has(input.outcome)) {
    return input.attempt < input.maxAttempts ? "retry" : "review";
  }
  if (quarantineOutcomes.has(input.outcome)) return "quarantine";
  return "review";
}

function retryFor(
  outcome: MonitorOutcome,
  attempt: number,
  maxAttempts: number,
): MonitorRetry {
  const eligible = retryableOutcomes.has(outcome) && attempt < maxAttempts;
  return {
    attempt,
    maxAttempts,
    eligible,
    backoffSeconds: eligible
      ? [1, 5, 30].slice(0, Math.min(3, maxAttempts))
      : [],
  };
}

function quarantineIdFor(input: {
  sourceFamily: string;
  adapterId: string;
  outcome: MonitorOutcome;
  baseline: SnapshotReference;
  candidate: SnapshotReference | null;
  addedCoordinates: readonly string[];
  removedCoordinates: readonly string[];
  changedSources: readonly MonitorSourceChange[];
  affectedTuples: readonly string[];
}): string {
  return sha256(
    canonicalJson({
      sourceFamily: input.sourceFamily,
      adapterId: input.adapterId,
      outcome: input.outcome,
      baseline: input.baseline,
      candidate: input.candidate,
      addedCoordinates: input.addedCoordinates,
      removedCoordinates: input.removedCoordinates,
      changedSources: input.changedSources,
      affectedTuples: input.affectedTuples,
    }),
  );
}

export function buildMonitorRun(input: MonitorObservation): MonitorRun {
  requireIdentifier(input.sourceFamily, "monitor source family");
  requireIdentifier(input.adapterId, "monitor adapter id");
  requireTimestamp(input.generatedAt);
  requireSnapshot(input.baseline, "baseline");
  if (input.candidate) requireSnapshot(input.candidate, "candidate");
  const outcome = inferredOutcome(input);
  const attempt = input.attempt ?? 0;
  const maxAttempts = input.maxAttempts ?? 3;
  const addedCoordinates = uniqueSorted(
    input.addedCoordinates ?? input.reconciliation?.addedCoordinates ?? [],
  );
  const removedCoordinates = uniqueSorted(
    input.removedCoordinates ?? input.reconciliation?.removedCoordinates ?? [],
  );
  const changedSources = normalizedChanges(
    input.changedSources ?? input.reconciliation?.changedSources ?? [],
  );
  const affectedTuples = uniqueSorted(input.affectedTuples ?? []);
  const classification = classifyMonitorEvent({
    outcome,
    attempt,
    maxAttempts,
    addedCoordinates,
    removedCoordinates,
    changedSources,
  });
  if (
    (outcome === "additions" || outcome === "compatibility-boundary") &&
    !input.candidate
  ) {
    throw new Error(`${outcome} monitor outcome requires a candidate snapshot`);
  }
  const retry = retryFor(outcome, attempt, maxAttempts);
  const policy: MonitorPolicy = {
    proposeCandidate:
      classification === "additive" || classification === "boundary",
    requiresPullRequest:
      classification === "additive" ||
      classification === "boundary" ||
      classification === "review",
    preserveLastKnownGood: true,
    publicationBlocked: classification !== "no-change",
  };
  const reasons = uniqueSorted([
    `${outcome} observation for ${input.sourceFamily}`,
    ...(addedCoordinates.length > 0
      ? [
          `${addedCoordinates.length} new coordinate(s) require exact verification`,
        ]
      : []),
    ...(removedCoordinates.length > 0
      ? [`${removedCoordinates.length} removed coordinate(s) remain preserved`]
      : []),
    ...(changedSources.length > 0
      ? [`${changedSources.length} source digest change(s) require review`]
      : []),
    ...(retry.eligible
      ? [`transient failure may retry until attempt ${maxAttempts}`]
      : []),
    ...(input.reasons ?? []),
  ]);
  const base = {
    $schema: monitorRunSchema,
    schemaVersion: 1 as const,
    kind: "monitor-run" as const,
    generatedAt: input.generatedAt,
    sourceFamily: input.sourceFamily,
    adapterId: input.adapterId,
    outcome,
    classification,
    baseline: input.baseline,
    candidate: input.candidate,
    addedCoordinates,
    removedCoordinates,
    changedSources,
    affectedTuples,
    retry,
    policy,
    reasons,
  };
  const quarantineId = isQuarantineRequired(outcome)
    ? quarantineIdFor({
        sourceFamily: input.sourceFamily,
        adapterId: input.adapterId,
        outcome,
        baseline: input.baseline,
        candidate: input.candidate,
        addedCoordinates,
        removedCoordinates,
        changedSources,
        affectedTuples,
      })
    : undefined;
  const document = { ...base, ...(quarantineId ? { quarantineId } : {}) };
  const identity = { ...document };
  delete (identity as { generatedAt?: string }).generatedAt;
  return {
    ...document,
    runId: sha256(canonicalJson(identity)),
  };
}

function quarantineSteps(outcome: MonitorOutcome): string[] {
  const common = [
    "preserve the last known good snapshot and published catalog",
    "block publication and generation for the affected candidate",
  ];
  if (outcome === "artifact-mutated" || outcome === "artifact-missing") {
    return [
      ...common,
      "capture a fresh artifact digest from the authoritative origin",
      "rerun exact tuple verification before resolving the quarantine",
    ];
  }
  if (outcome === "empty-response" || outcome === "malformed-response") {
    return [
      ...common,
      "inspect the raw bounded response and parser diagnostics",
      "retry only after the source contract is confirmed healthy",
    ];
  }
  if (outcome === "bulk-removal") {
    return [
      ...common,
      "compare the complete source response with the prior snapshot",
      "approve an explicit removal review before changing coverage",
    ];
  }
  return [
    ...common,
    "identify the deterministic compatibility or repository defect",
    "rerun the affected verification set before resolving the quarantine",
  ];
}

export function buildQuarantineRecord(run: MonitorRun): QuarantineRecord {
  if (!isQuarantineRequired(run.outcome)) {
    throw new Error(
      `monitor outcome ${run.outcome} does not require quarantine`,
    );
  }
  if (run.classification !== "quarantine") {
    throw new Error("quarantine record requires a quarantined monitor run");
  }
  if (!run.quarantineId) {
    throw new Error("quarantined monitor run has no quarantine id");
  }
  const core = {
    sourceFamily: run.sourceFamily,
    adapterId: run.adapterId,
    outcome: run.outcome,
    baseline: run.baseline,
    candidate: run.candidate,
    addedCoordinates: run.addedCoordinates,
    removedCoordinates: run.removedCoordinates,
    changedSources: run.changedSources,
    affectedTuples: run.affectedTuples,
  };
  const expectedId = quarantineIdFor(core);
  if (expectedId !== run.quarantineId) {
    throw new Error("monitor quarantine id does not match its inputs");
  }
  const withoutId = {
    $schema: quarantineRecordSchema,
    schemaVersion: 1 as const,
    kind: "quarantine-record" as const,
    createdAt: run.generatedAt,
    sourceFamily: run.sourceFamily,
    adapterId: run.adapterId,
    outcome: run.outcome as QuarantineRecord["outcome"],
    baseline: run.baseline,
    candidate: run.candidate,
    affectedCoordinates: uniqueSorted([
      ...run.addedCoordinates,
      ...run.removedCoordinates,
    ]),
    affectedTuples: uniqueSorted(run.affectedTuples),
    preserveLastKnownGood: true as const,
    publicationBlocked: true as const,
    status: "open" as const,
    recoverySteps: quarantineSteps(run.outcome),
    reason: run.reasons.join(". "),
    ...(run.retry.eligible
      ? { retryAfterSeconds: run.retry.backoffSeconds[0] ?? 1 }
      : {}),
  };
  return { ...withoutId, quarantineId: run.quarantineId };
}
