import { describe, expect, it } from "vitest";
import { buildMaintenancePlan } from "../src/phase7-maintenance.js";
import { buildMaintenanceProposal } from "../src/phase7-proposal.js";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";

const digest = (value: string): string => value.repeat(64);

function planInput() {
  return {
    sourceFamily: "forge",
    generatedAt: "2026-08-10T00:00:00.000Z",
    baseline: { id: "forge-baseline", digest: digest("a") },
    candidate: { id: "forge-candidate", digest: digest("b") },
    reconciliation: {
      previousSnapshotId: "forge-baseline",
      candidateSnapshotId: "forge-candidate",
      addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.3.0"],
      removedCoordinates: [],
      changedSources: [],
      requiresReview: false,
    },
    event: { kind: "source-success" as const, attempt: 0, maxAttempts: 3 },
    affectedTuples: ["tuple-a"],
  };
}

function plan() {
  return buildMaintenancePlan(planInput());
}

describe("phase 7 maintenance proposals", () => {
  it("creates a deduplicated reviewed proposal with rollback evidence", async () => {
    const first = buildMaintenanceProposal({
      plan: plan(),
      generatedAt: "2026-08-10T00:00:00.000Z",
      candidatePaths: ["verification/phase7/candidates/forge.json"],
    });
    const second = buildMaintenanceProposal({
      plan: plan(),
      generatedAt: "2026-08-11T00:00:00.000Z",
      candidatePaths: ["verification/phase7/candidates/forge.json"],
    });
    expect(first.status).toBe("ready-for-review");
    expect(first.requiresReview).toBe(true);
    expect(first.autoMerge).toBe(false);
    expect(first.proposalId).toBe(second.proposalId);
    expect(first.digest).not.toBe(second.digest);
    expect(first.branchName).toMatch(/^envy\/maintenance\/[a-f0-9]{16}$/u);
    expect(first.rollback.preserveBaseline).toBe(true);
    expect(validateWithSchema(await createSchemaRegistry(), first).valid).toBe(
      true,
    );
  });

  it("blocks quarantine proposals and preserves no change proposals", () => {
    const quarantine = buildMaintenanceProposal({
      plan: buildMaintenancePlan({
        ...planInput(),
        event: { kind: "empty-response", attempt: 0, maxAttempts: 3 },
        candidate: null,
      }),
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(quarantine.status).toBe("blocked");
    const unchanged = buildMaintenanceProposal({
      plan: buildMaintenancePlan({
        ...planInput(),
        reconciliation: {
          ...planInput().reconciliation,
          addedCoordinates: [],
        },
      }),
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(unchanged.status).toBe("no-change");
  });
});
