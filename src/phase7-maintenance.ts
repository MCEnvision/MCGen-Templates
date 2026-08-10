import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import type { SnapshotReconciliation } from "./reconcile.js";

export const maintenancePlanSchema =
  "urn:mcgen:schema:maintenance-plan:1" as const;
export const maintenanceAuditSchema =
  "urn:mcgen:schema:maintenance-audit:1" as const;
export const maintenanceRecoverySchema =
  "urn:mcgen:schema:maintenance-recovery:1" as const;

export type MaintenanceEventKind =
  | "source-success"
  | "compatibility-boundary"
  | "source-outage"
  | "empty-response"
  | "malformed-response"
  | "bulk-removal"
  | "artifact-mutation"
  | "template-failure"
  | "transient-failure";

export type MaintenanceEvent = {
  kind: MaintenanceEventKind;
  attempt: number;
  maxAttempts: number;
};

export type MaintenancePlan = {
  $schema: typeof maintenancePlanSchema;
  schemaVersion: 1;
  kind: "maintenance-plan";
  planId: string;
  generatedAt: string;
  sourceFamily: string;
  event: MaintenanceEvent;
  baseline: { id: string; digest: string };
  candidate: { id: string; digest: string } | null;
  action: "propose" | "review" | "retry" | "quarantine" | "preserve";
  requiresPullRequest: boolean;
  autoMerge: false;
  preserveLastKnownGood: boolean;
  affectedCoordinates: string[];
  affectedTuples: string[];
  invalidationScope: string[];
  retry: {
    eligible: boolean;
    attempt: number;
    maxAttempts: number;
    backoffSeconds: number[];
  };
  recovery: {
    status:
      | "not-needed"
      | "retry-scheduled"
      | "preserved"
      | "quarantined"
      | "review-required";
    steps: string[];
  };
  reasons: string[];
};

const retryable = new Set<MaintenanceEventKind>([
  "source-outage",
  "transient-failure",
]);
const destructive = new Set<MaintenanceEventKind>([
  "empty-response",
  "malformed-response",
  "bulk-removal",
  "artifact-mutation",
  "template-failure",
]);

function actionFor(
  event: MaintenanceEvent,
  reconciliation: SnapshotReconciliation,
): MaintenancePlan["action"] {
  if (
    event.kind === "source-success" &&
    reconciliation.addedCoordinates.length === 0 &&
    reconciliation.removedCoordinates.length === 0 &&
    reconciliation.changedSources.length === 0 &&
    !reconciliation.requiresReview
  )
    return "preserve";
  if (retryable.has(event.kind) && event.attempt < event.maxAttempts)
    return "retry";
  if (retryable.has(event.kind)) return "preserve";
  if (destructive.has(event.kind)) return "quarantine";
  if (event.kind === "bulk-removal" || event.kind === "artifact-mutation")
    return "quarantine";
  if (event.kind === "compatibility-boundary") return "review";
  if (reconciliation.requiresReview) return "review";
  if (
    reconciliation.removedCoordinates.length ||
    reconciliation.changedSources.length
  )
    return "review";
  return "propose";
}

function scopeFor(
  event: MaintenanceEvent,
  reconciliation: SnapshotReconciliation,
): string[] {
  const scope = new Set<string>(["source-snapshot"]);
  if (
    reconciliation.addedCoordinates.length ||
    reconciliation.removedCoordinates.length
  )
    scope.add("catalog");
  if (event.kind === "compatibility-boundary") scope.add("profiles");
  if (event.kind === "template-failure") {
    scope.add("templates");
    scope.add("fixtures");
  }
  if (
    event.kind === "artifact-mutation" ||
    reconciliation.changedSources.length
  ) {
    scope.add("tuple-evidence");
    scope.add("release");
  }
  return [...scope].sort(compareText);
}

export function buildMaintenancePlan(input: {
  sourceFamily: string;
  generatedAt: string;
  baseline: { id: string; digest: string };
  candidate: { id: string; digest: string } | null;
  reconciliation: SnapshotReconciliation;
  event: MaintenanceEvent;
  affectedTuples?: readonly string[];
}): MaintenancePlan {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(input.sourceFamily))
    throw new Error("maintenance source family must be a stable identifier");
  if (
    !Number.isInteger(input.event.attempt) ||
    !Number.isInteger(input.event.maxAttempts) ||
    input.event.attempt < 0 ||
    input.event.maxAttempts < 0 ||
    input.event.maxAttempts > 10 ||
    input.event.attempt > input.event.maxAttempts
  )
    throw new Error("maintenance retry attempt is outside its bound");
  const action = actionFor(input.event, input.reconciliation);
  const preserveLastKnownGood = true;
  const eligible =
    retryable.has(input.event.kind) &&
    input.event.attempt < input.event.maxAttempts;
  const recoveryStatus: MaintenancePlan["recovery"]["status"] = eligible
    ? "retry-scheduled"
    : action === "quarantine"
      ? "quarantined"
      : action === "review"
        ? "review-required"
        : "preserved";
  const reasons = [
    `${input.event.kind} event for ${input.sourceFamily}`,
    ...(input.reconciliation.addedCoordinates.length
      ? [
          `${input.reconciliation.addedCoordinates.length} new coordinates require exact catalog review`,
        ]
      : []),
    ...(input.reconciliation.removedCoordinates.length
      ? [
          `${input.reconciliation.removedCoordinates.length} removed coordinates remain preserved and require review`,
        ]
      : []),
    ...(input.reconciliation.changedSources.length
      ? [
          `${input.reconciliation.changedSources.length} source digests changed and invalidate dependent evidence`,
        ]
      : []),
  ].sort(compareText);
  const retry = {
    eligible,
    attempt: input.event.attempt,
    maxAttempts: input.event.maxAttempts,
    backoffSeconds: eligible
      ? [1, 5, 30].slice(0, Math.max(1, Math.min(3, input.event.maxAttempts)))
      : [],
  };
  const recovery = {
    status: recoveryStatus,
    steps: [
      ...(eligible
        ? ["retry the bounded fetch or build with the next backoff"]
        : []),
      "retain the baseline snapshot and published catalog",
      ...(action === "quarantine"
        ? ["quarantine the candidate and block publication"]
        : []),
      ...(action === "review"
        ? ["open a reviewed maintenance pull request with the exact delta"]
        : []),
      ...(action === "propose"
        ? ["run deterministic catalog and tuple verification before merge"]
        : []),
    ],
  };
  const withoutId = {
    $schema: maintenancePlanSchema,
    schemaVersion: 1 as const,
    kind: "maintenance-plan" as const,
    generatedAt: input.generatedAt,
    sourceFamily: input.sourceFamily,
    event: input.event,
    baseline: input.baseline,
    candidate: input.candidate,
    action,
    requiresPullRequest: action === "propose" || action === "review",
    autoMerge: false as const,
    preserveLastKnownGood,
    affectedCoordinates: [
      ...input.reconciliation.addedCoordinates,
      ...input.reconciliation.removedCoordinates,
    ].sort(compareText),
    affectedTuples: [...new Set(input.affectedTuples ?? [])].sort(compareText),
    invalidationScope: scopeFor(input.event, input.reconciliation),
    retry,
    recovery,
    reasons,
  };
  const identity = { ...withoutId };
  delete (identity as { generatedAt?: string }).generatedAt;
  return { ...withoutId, planId: sha256(canonicalJson(identity)) };
}

export const repositoryAuditRequirementIds = [
  "governance",
  "planning",
  "source-adapters",
  "catalog-coverage",
  "forge-toolchain",
  "neoforge-fabric",
  "plugin-proxy-catalogs",
  "architectury-multiloader",
  "customization-contracts",
  "asset-version-overrides",
  "tuple-evidence",
  "deterministic-pack",
  "immutable-release",
  "maintenance-automation",
  "failure-recovery",
  "security-controls",
  "required-checks",
  "tracked-file-hygiene",
  "documentation-wiki",
  "deferred-ownership",
] as const;

export type RepositoryAuditRequirementId =
  (typeof repositoryAuditRequirementIds)[number];

export function buildMaintenanceAudit(input: {
  generatedAt: string;
  requirements: Readonly<
    Record<RepositoryAuditRequirementId, { passed: boolean; detail: string }>
  >;
}) {
  const requirements = repositoryAuditRequirementIds.map((id) => ({
    id,
    passed: input.requirements[id].passed,
    detail: input.requirements[id].detail,
  }));
  const blockers = requirements
    .filter((requirement) => !requirement.passed)
    .map((requirement) => `${requirement.id}: ${requirement.detail}`);
  const withoutDigest = {
    $schema: maintenanceAuditSchema,
    schemaVersion: 1 as const,
    kind: "maintenance-audit" as const,
    generatedAt: input.generatedAt,
    status: blockers.length ? ("blocked" as const) : ("passed" as const),
    requirements,
    blockers,
  };
  return { ...withoutDigest, digest: sha256(canonicalJson(withoutDigest)) };
}

export type RecoveryScenario =
  | "new-component"
  | "new-boundary"
  | "outage"
  | "empty-response"
  | "bulk-removal"
  | "artifact-mutation"
  | "transient-build"
  | "template-failure"
  | "historical-rebuild";

export function simulateRecovery(scenario: RecoveryScenario) {
  const destructiveScenario = new Set<RecoveryScenario>([
    "empty-response",
    "bulk-removal",
    "artifact-mutation",
    "template-failure",
  ]).has(scenario);
  const retryScenario = scenario === "outage" || scenario === "transient-build";
  const action = destructiveScenario
    ? "quarantine"
    : scenario === "new-boundary"
      ? "review"
      : retryScenario
        ? "retry"
        : "propose";
  const steps = [
    ...(retryScenario
      ? ["retry with bounded backoff and stop at the attempt limit"]
      : []),
    ...(destructiveScenario
      ? ["preserve the last known good snapshot and quarantine the candidate"]
      : []),
    ...(scenario === "historical-rebuild"
      ? ["rebuild from the pinned release evidence without upstream access"]
      : []),
    ...(action === "review"
      ? [
          "open a reviewed maintenance change for the new compatibility boundary",
        ]
      : []),
    ...(action === "propose"
      ? ["open a reviewed maintenance change after deterministic verification"]
      : []),
  ];
  const withoutDigest = {
    $schema: maintenanceRecoverySchema,
    schemaVersion: 1 as const,
    kind: "maintenance-recovery" as const,
    scenario,
    status: "passed" as const,
    preserved: destructiveScenario,
    action,
    steps,
  };
  return { ...withoutDigest, digest: sha256(canonicalJson(withoutDigest)) };
}
