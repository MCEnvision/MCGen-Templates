import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import type { InvalidationPlan } from "./phase7-invalidation.js";
import type { MaintenancePlan } from "./phase7-maintenance.js";
import type { MonitorRun, MonitorSourceChange } from "./phase7-monitor.js";

export const maintenancePullRequestSchema =
  "urn:mcgen:schema:maintenance-pull-request:1" as const;

type Snapshot = { id: string; digest: string };

export type MaintenancePullRequest = {
  $schema: typeof maintenancePullRequestSchema;
  schemaVersion: 1;
  kind: "maintenance-pull-request";
  pullRequestId: string;
  digest: string;
  generatedAt: string;
  deduplicationKey: string;
  status: "no-change" | "ready-for-review" | "blocked";
  blockers: string[];
  sourceFamily: string;
  baseline: Snapshot;
  candidate: Snapshot | null;
  branchName: string;
  title: string;
  body: string;
  sourceDelta: {
    addedSourceIds: string[];
    removedSourceIds: string[];
    changedSources: MonitorSourceChange[];
  };
  catalogDelta: {
    addedCoordinates: string[];
    removedCoordinates: string[];
    changedCoordinates: string[];
  };
  blastRadius: {
    families: string[];
    profiles: string[];
    tuples: string[];
  };
  evidence: {
    invalidationPlanId: string | null;
    invalidatedTupleIds: string[];
    rebuildScope: string[];
  };
  coverage: {
    baseline: { total: number; verified: number; unresolved: number } | null;
    candidate: { total: number; verified: number; unresolved: number } | null;
    delta: {
      total: number | null;
      verified: number | null;
      unresolved: number | null;
    };
    blockers: string[];
  };
  changedFiles: { path: string; area: "source" | "catalog" | "other" }[];
  verification: {
    commands: string[];
    exactTupleIds: string[];
    deterministicRequired: true;
    artifactInspectionRequired: true;
  };
  publication: {
    baseBranch: "main";
    createBranch: boolean;
    createPullRequest: boolean;
    remoteWrites: false;
    githubAppDeferred: true;
    preserveBaseline: true;
    requiresReview: true;
    autoMerge: false;
    majorBoundaryReviewRequired: true;
  };
};

export type CoverageChangeInput = {
  baseline: { total: number; verified: number; unresolved: number } | null;
  candidate: { total: number; verified: number; unresolved: number } | null;
  blockers: readonly string[];
};

const digestPattern = /^[a-f0-9]{64}$/u;
const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;
const pathPattern = /^[a-zA-Z0-9._/-]+$/u;
const emptySourceDigest = sha256(canonicalJson([]));

function requireIdentifier(value: string, label: string): void {
  if (!identifierPattern.test(value)) throw new Error(`${label} is invalid`);
}

function requireDigest(value: string, label: string): void {
  if (!digestPattern.test(value)) throw new Error(`${label} is invalid`);
}

function requireTimestamp(value: string): void {
  if (!value.endsWith("Z") || Number.isNaN(Date.parse(value))) {
    throw new Error("pull request generatedAt must be an iso timestamp in utc");
  }
}

function requireSnapshot(value: Snapshot, label: string): void {
  if (typeof value.id !== "string" || typeof value.digest !== "string")
    throw new Error(`${label} snapshot is invalid`);
  requireIdentifier(value.id, `${label} snapshot id`);
  requireDigest(value.digest, `${label} snapshot digest`);
}

function sorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

function requirePath(value: string): void {
  if (
    !pathPattern.test(value) ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").some((part) => part === ".." || part === "") ||
    value === "." ||
    value === ".."
  ) {
    throw new Error(`pull request changed path is unsafe ${value}`);
  }
}

function fileArea(path: string): "source" | "catalog" | "other" {
  if (path.startsWith("sources/")) return "source";
  if (path.startsWith("catalog/")) return "catalog";
  return "other";
}

function requireCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
}

function normalizedCoverage(
  input: CoverageChangeInput | undefined,
  required: boolean,
) {
  if (!input) {
    return {
      baseline: null,
      candidate: null,
      delta: { total: null, verified: null, unresolved: null },
      blockers: required
        ? ["coverage is pending exact tuple verification"]
        : [],
    };
  }
  for (const [label, point] of [
    ["baseline", input.baseline],
    ["candidate", input.candidate],
  ] as const) {
    if (!point) continue;
    requireCount(point.total, `coverage ${label} total`);
    requireCount(point.verified, `coverage ${label} verified`);
    requireCount(point.unresolved, `coverage ${label} unresolved`);
    if (point.verified + point.unresolved > point.total) {
      throw new Error(`coverage ${label} counts exceed total`);
    }
  }
  const baseline = input.baseline;
  const candidate = input.candidate;
  return {
    baseline,
    candidate,
    delta: {
      total: baseline && candidate ? candidate.total - baseline.total : null,
      verified:
        baseline && candidate ? candidate.verified - baseline.verified : null,
      unresolved:
        baseline && candidate
          ? candidate.unresolved - baseline.unresolved
          : null,
    },
    blockers: sorted(input.blockers),
  };
}

function monitorDeltas(
  plan: MaintenancePlan,
  monitor:
    | Pick<
        MonitorRun,
        | "sourceFamily"
        | "baseline"
        | "candidate"
        | "addedCoordinates"
        | "removedCoordinates"
        | "changedSources"
        | "affectedTuples"
      >
    | undefined,
) {
  if (!monitor) {
    return {
      addedSourceIds: [],
      removedSourceIds: [],
      changedSources: [],
      addedCoordinates: [],
      removedCoordinates: [],
      changedCoordinates: [],
      tuples: [...plan.affectedTuples],
    };
  }
  if (monitor.sourceFamily !== plan.sourceFamily) {
    throw new Error("pull request monitor source family does not match plan");
  }
  if (
    monitor.baseline.id !== plan.baseline.id ||
    monitor.baseline.digest !== plan.baseline.digest
  ) {
    throw new Error("pull request monitor baseline does not match plan");
  }
  if (
    (monitor.candidate?.id ?? null) !== (plan.candidate?.id ?? null) ||
    (monitor.candidate?.digest ?? null) !== (plan.candidate?.digest ?? null)
  ) {
    throw new Error("pull request monitor candidate does not match plan");
  }
  const changedSources = [...monitor.changedSources]
    .map((change) => {
      requireIdentifier(change.sourceId, "pull request source id");
      requireDigest(
        change.previousDigest,
        "pull request previous source digest",
      );
      requireDigest(
        change.candidateDigest,
        "pull request candidate source digest",
      );
      if (change.previousDigest === change.candidateDigest) {
        throw new Error(
          `pull request source ${change.sourceId} did not change`,
        );
      }
      return change;
    })
    .sort((left, right) => compareText(left.sourceId, right.sourceId));
  const addedSourceIds = changedSources
    .filter((change) => change.previousDigest === emptySourceDigest)
    .map((change) => change.sourceId);
  const removedSourceIds = changedSources
    .filter((change) => change.candidateDigest === emptySourceDigest)
    .map((change) => change.sourceId);
  return {
    addedSourceIds: sorted(addedSourceIds),
    removedSourceIds: sorted(removedSourceIds),
    changedSources,
    addedCoordinates: sorted(monitor.addedCoordinates),
    removedCoordinates: sorted(monitor.removedCoordinates),
    changedCoordinates: [],
    tuples: sorted([...plan.affectedTuples, ...monitor.affectedTuples]),
  };
}

export function buildMaintenancePullRequest(input: {
  plan: MaintenancePlan;
  monitor?: Pick<
    MonitorRun,
    | "sourceFamily"
    | "baseline"
    | "candidate"
    | "addedCoordinates"
    | "removedCoordinates"
    | "changedSources"
    | "affectedTuples"
  >;
  invalidation?: Pick<
    InvalidationPlan,
    "planId" | "sourceFamily" | "tupleIds" | "summary"
  >;
  coverage?: CoverageChangeInput;
  generatedAt: string;
  familyIds?: readonly string[];
  profileIds?: readonly string[];
  changedPaths?: readonly string[];
  releaseTag?: string;
}): MaintenancePullRequest {
  const plan = input.plan;
  requireIdentifier(plan.sourceFamily, "pull request source family");
  requireDigest(plan.planId, "pull request maintenance plan id");
  requireSnapshot(plan.baseline, "pull request baseline");
  if (plan.candidate) requireSnapshot(plan.candidate, "pull request candidate");
  requireTimestamp(input.generatedAt);
  const monitor = monitorDeltas(plan, input.monitor);
  if (input.invalidation) {
    requireDigest(
      input.invalidation.planId,
      "pull request invalidation plan id",
    );
    if (input.invalidation.sourceFamily !== plan.sourceFamily)
      throw new Error(
        "pull request invalidation source family does not match plan",
      );
  }
  const families = sorted([plan.sourceFamily, ...(input.familyIds ?? [])]);
  families.forEach((family) =>
    requireIdentifier(family, "pull request family id"),
  );
  const profiles = sorted(input.profileIds ?? []);
  profiles.forEach((profile) =>
    requireIdentifier(profile, "pull request profile id"),
  );
  const changedPaths = sorted(input.changedPaths ?? []);
  changedPaths.forEach(requirePath);
  const changedFiles = changedPaths.map((path) => ({
    path,
    area: fileArea(path),
  }));
  const tuples = sorted([
    ...monitor.tuples,
    ...(input.invalidation?.tupleIds ?? []),
  ]);
  const invalidatedTupleIds = sorted(input.invalidation?.tupleIds ?? []);
  const rebuildScope = sorted([
    ...plan.invalidationScope,
    ...(invalidatedTupleIds.length ? ["tuple-evidence"] : []),
    ...(invalidatedTupleIds.length ? ["release"] : []),
  ]);
  rebuildScope.forEach((scope) =>
    requireIdentifier(scope, "pull request rebuild scope"),
  );
  const requiredReview = plan.action === "propose" || plan.action === "review";
  const blockers: string[] = [];
  if (requiredReview && !input.monitor)
    blockers.push(
      "monitor run is required to materialize source and catalog deltas",
    );
  if (plan.action === "retry")
    blockers.push(
      "transient failure must finish bounded retry before publication",
    );
  if (plan.action === "quarantine")
    blockers.push("candidate is quarantined and publication is blocked");
  const status: MaintenancePullRequest["status"] =
    plan.action === "preserve"
      ? "no-change"
      : blockers.length
        ? "blocked"
        : "ready-for-review";
  const coverage = normalizedCoverage(input.coverage, requiredReview);
  const coverageBlockers = sorted(coverage.blockers);
  const affectedFamilies = families;
  const boundary =
    plan.action === "review" ||
    rebuildScope.some((scope) =>
      ["profiles", "templates", "release"].includes(scope),
    );
  const structural = {
    sourceFamily: plan.sourceFamily,
    baseline: plan.baseline,
    candidate: plan.candidate,
    sourceDelta: {
      addedSourceIds: monitor.addedSourceIds,
      removedSourceIds: monitor.removedSourceIds,
      changedSources: monitor.changedSources,
    },
    catalogDelta: {
      addedCoordinates: monitor.addedCoordinates,
      removedCoordinates: monitor.removedCoordinates,
      changedCoordinates: monitor.changedCoordinates,
    },
    blastRadius: { families: affectedFamilies, profiles, tuples },
    evidence: {
      invalidationPlanId: input.invalidation?.planId ?? null,
      invalidatedTupleIds,
      rebuildScope,
    },
    coverage,
    changedFiles,
    status,
    blockers,
    coverageBlockers,
    releaseTag: input.releaseTag ?? "v1.0.0-beta.1",
  };
  const deduplicationKey = sha256(
    canonicalJson({ planId: plan.planId, ...structural }),
  );
  const branchName = `envy/maintenance/${deduplicationKey.slice(0, 16)}`;
  const title = `maintenance update for ${plan.sourceFamily} ${deduplicationKey.slice(0, 12)}`;
  const body = [
    `source family, ${plan.sourceFamily}`,
    `maintenance plan, ${plan.planId}`,
    `baseline snapshot, ${plan.baseline.id} ${plan.baseline.digest}`,
    `candidate snapshot, ${plan.candidate ? `${plan.candidate.id} ${plan.candidate.digest}` : "none"}`,
    `source delta, added ${monitor.addedSourceIds.length}, removed ${monitor.removedSourceIds.length}, changed ${monitor.changedSources.length}`,
    `catalog delta, added ${monitor.addedCoordinates.length}, removed ${monitor.removedCoordinates.length}, changed ${monitor.changedCoordinates.length}`,
    `affected families, ${affectedFamilies.join(", ")}`,
    `affected profiles, ${profiles.join(", ") || "none"}`,
    `affected tuples, ${tuples.length}`,
    `invalidation plan, ${input.invalidation?.planId ?? "none"}`,
    `rebuild scope, ${rebuildScope.join(", ") || "none"}`,
    `coverage blockers, ${coverageBlockers.join(", ") || "none"}`,
    `review required, true, auto merge, false, major boundary review, ${boundary}`,
    "remote branch and pull request creation remain deferred to the github app",
  ].join("\n");
  const withoutIds = {
    $schema: maintenancePullRequestSchema,
    schemaVersion: 1 as const,
    kind: "maintenance-pull-request" as const,
    generatedAt: input.generatedAt,
    deduplicationKey,
    status,
    blockers,
    sourceFamily: plan.sourceFamily,
    baseline: plan.baseline,
    candidate: plan.candidate,
    branchName,
    title,
    body,
    sourceDelta: structural.sourceDelta,
    catalogDelta: structural.catalogDelta,
    blastRadius: structural.blastRadius,
    evidence: structural.evidence,
    coverage: structural.coverage,
    changedFiles,
    verification: {
      commands: [
        "npm run verify",
        "npm run validate",
        "npm run phase5:validate-evidence",
      ],
      exactTupleIds: tuples,
      deterministicRequired: true as const,
      artifactInspectionRequired: true as const,
    },
    publication: {
      baseBranch: "main" as const,
      createBranch: status === "ready-for-review",
      createPullRequest: status === "ready-for-review",
      remoteWrites: false as const,
      githubAppDeferred: true as const,
      preserveBaseline: true as const,
      requiresReview: true as const,
      autoMerge: false as const,
      majorBoundaryReviewRequired: true as const,
    },
  };
  const identity = { ...withoutIds };
  delete (identity as { generatedAt?: string }).generatedAt;
  const pullRequestId = sha256(canonicalJson(identity));
  const withId = { ...withoutIds, pullRequestId };
  return { ...withId, digest: sha256(canonicalJson(withId)) };
}
