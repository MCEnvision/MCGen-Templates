import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import type { MaintenancePlan } from "./phase7-maintenance.js";

export const maintenanceProposalSchema =
  "urn:mcgen:schema:maintenance-proposal:1" as const;

export type MaintenanceProposal = {
  $schema: typeof maintenanceProposalSchema;
  schemaVersion: 1;
  kind: "maintenance-proposal";
  proposalId: string;
  digest: string;
  generatedAt: string;
  deduplicationKey: string;
  status: "no-change" | "ready-for-review" | "blocked";
  sourceFamily: string;
  baseline: { id: string; digest: string };
  candidate: { id: string; digest: string } | null;
  branchName: string;
  title: string;
  body: string;
  affectedCoordinates: string[];
  affectedTuples: string[];
  invalidationScope: string[];
  candidatePaths: string[];
  verificationCommands: string[];
  rollback: {
    preserveBaseline: true;
    releaseTag: string;
    baselineReference: string;
  };
  requiresReview: true;
  autoMerge: false;
};

function stableIdentifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value))
    throw new Error(`${label} must be a stable identifier`);
}

function digest(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value))
    throw new Error(`${label} must be a lowercase sha256 digest`);
}

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

export function buildMaintenanceProposal(input: {
  plan: MaintenancePlan;
  generatedAt: string;
  candidatePaths?: readonly string[];
  releaseTag?: string;
}): MaintenanceProposal {
  const plan = input.plan;
  stableIdentifier(plan.sourceFamily, "proposal source family");
  digest(plan.planId, "proposal maintenance plan id");
  digest(plan.baseline.digest, "proposal baseline digest");
  if (plan.candidate)
    digest(plan.candidate.digest, "proposal candidate digest");
  if (
    !input.generatedAt.endsWith("Z") ||
    Number.isNaN(Date.parse(input.generatedAt))
  )
    throw new Error("proposal generatedAt must be an iso timestamp in utc");
  const status: MaintenanceProposal["status"] =
    plan.action === "preserve"
      ? "no-change"
      : plan.action === "quarantine"
        ? "blocked"
        : "ready-for-review";
  const branchName = `envy/maintenance/${plan.planId.slice(0, 16)}`;
  const title = `maintenance update for ${plan.sourceFamily} ${plan.planId.slice(0, 12)}`;
  const affectedCoordinates = sorted(plan.affectedCoordinates);
  const affectedTuples = sorted(plan.affectedTuples);
  const invalidationScope = sorted(plan.invalidationScope);
  const candidatePaths = sorted(input.candidatePaths ?? []);
  const releaseTag = input.releaseTag ?? "v1.0.0-beta.1";
  const body = [
    `source family, ${plan.sourceFamily}`,
    `maintenance plan, ${plan.planId}`,
    `baseline snapshot, ${plan.baseline.id} ${plan.baseline.digest}`,
    `candidate snapshot, ${plan.candidate ? `${plan.candidate.id} ${plan.candidate.digest}` : "none"}`,
    `action, ${plan.action}`,
    `affected coordinates, ${affectedCoordinates.length}`,
    `affected tuples, ${affectedTuples.length}`,
    `invalidation scope, ${invalidationScope.join(", ") || "none"}`,
    "publication remains blocked until review and deterministic verification pass",
  ].join("\n");
  const withoutIds = {
    $schema: maintenanceProposalSchema,
    schemaVersion: 1 as const,
    kind: "maintenance-proposal" as const,
    generatedAt: input.generatedAt,
    deduplicationKey: plan.planId,
    status,
    sourceFamily: plan.sourceFamily,
    baseline: plan.baseline,
    candidate: plan.candidate,
    branchName,
    title,
    body,
    affectedCoordinates,
    affectedTuples,
    invalidationScope,
    candidatePaths,
    verificationCommands: [
      "npm run verify",
      "npm run validate",
      "npm run phase5:validate-evidence",
    ],
    rollback: {
      preserveBaseline: true as const,
      releaseTag,
      baselineReference: plan.baseline.id,
    },
    requiresReview: true as const,
    autoMerge: false as const,
  };
  const identity = { ...withoutIds };
  delete (identity as { generatedAt?: string }).generatedAt;
  const proposalId = sha256(canonicalJson(identity));
  const withId = { ...withoutIds, proposalId };
  return { ...withId, digest: sha256(canonicalJson(withId)) };
}
