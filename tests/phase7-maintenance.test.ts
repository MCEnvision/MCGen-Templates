import { describe, expect, it } from "vitest";
import {
  buildMaintenanceAudit,
  buildMaintenancePlan,
  repositoryAuditRequirementIds,
  simulateRecovery,
} from "../src/phase7-maintenance.js";
import { canonicalJson } from "../src/canonical-json.js";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";

const baseline = { id: "forge-baseline", digest: "a".repeat(64) };
const candidate = { id: "forge-candidate", digest: "b".repeat(64) };

function reconciliation(
  overrides: Partial<
    Parameters<typeof buildMaintenancePlan>[0]["reconciliation"]
  > = {},
) {
  return {
    previousSnapshotId: baseline.id,
    candidateSnapshotId: candidate.id,
    addedCoordinates: [],
    removedCoordinates: [],
    changedSources: [],
    requiresReview: false,
    ...overrides,
  };
}

describe("phase 7 maintenance contracts", () => {
  it("proposes additive source changes without removing known content", () => {
    const plan = buildMaintenancePlan({
      sourceFamily: "forge",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate,
      reconciliation: reconciliation({
        addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.3.0"],
      }),
      event: { kind: "source-success", attempt: 0, maxAttempts: 3 },
      affectedTuples: ["tuple-b", "tuple-a"],
    });
    expect(plan.action).toBe("propose");
    expect(plan.requiresPullRequest).toBe(true);
    expect(plan.autoMerge).toBe(false);
    expect(plan.preserveLastKnownGood).toBe(true);
    expect(plan.affectedTuples).toEqual(["tuple-a", "tuple-b"]);
  });

  it("requires review for new boundaries and source mutations", () => {
    const plan = buildMaintenancePlan({
      sourceFamily: "fabric",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate,
      reconciliation: reconciliation({
        changedSources: [
          {
            sourceId: "fabric-meta",
            previousSha256: "a".repeat(64),
            candidateSha256: "b".repeat(64),
          },
        ],
      }),
      event: { kind: "compatibility-boundary", attempt: 0, maxAttempts: 3 },
    });
    expect(plan.action).toBe("review");
    expect(plan.invalidationScope).toContain("profiles");
    expect(plan.recovery.status).toBe("review-required");

    const boundary = buildMaintenancePlan({
      sourceFamily: "fabric",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate,
      reconciliation: reconciliation(),
      event: { kind: "compatibility-boundary", attempt: 0, maxAttempts: 3 },
    });
    expect(boundary.action).toBe("review");
    expect(boundary.requiresPullRequest).toBe(true);
  });

  it("preserves the baseline and quarantines destructive source failures", () => {
    for (const kind of [
      "empty-response",
      "malformed-response",
      "bulk-removal",
      "artifact-mutation",
    ] as const) {
      const plan = buildMaintenancePlan({
        sourceFamily: "paper",
        generatedAt: "2026-08-10T00:00:00.000Z",
        baseline,
        candidate: null,
        reconciliation: reconciliation({
          removedCoordinates: ["paper-api:1.0"],
        }),
        event: { kind, attempt: 0, maxAttempts: 3 },
      });
      expect(plan.action).toBe("quarantine");
      expect(plan.preserveLastKnownGood).toBe(true);
      expect(plan.recovery.status).toBe("quarantined");
    }
  });

  it("retries only transient failures within a fixed bound", () => {
    const retry = buildMaintenancePlan({
      sourceFamily: "mojang",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate: null,
      reconciliation: reconciliation(),
      event: { kind: "source-outage", attempt: 1, maxAttempts: 3 },
    });
    expect(retry.action).toBe("retry");
    expect(retry.retry.backoffSeconds).toEqual([1, 5, 30]);
    const exhausted = buildMaintenancePlan({
      sourceFamily: "mojang",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate: null,
      reconciliation: reconciliation(),
      event: { kind: "transient-failure", attempt: 3, maxAttempts: 3 },
    });
    expect(exhausted.action).toBe("preserve");
    expect(exhausted.retry.eligible).toBe(false);
    expect(() =>
      buildMaintenancePlan({
        sourceFamily: "mojang",
        generatedAt: "2026-08-10T00:00:00.000Z",
        baseline,
        candidate: null,
        reconciliation: reconciliation(),
        event: { kind: "source-outage", attempt: 0, maxAttempts: 11 },
      }),
    ).toThrow("outside its bound");
  });

  it("records an unchanged source as preserved without a pull request", () => {
    const plan = buildMaintenancePlan({
      sourceFamily: "forge",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate,
      reconciliation: reconciliation(),
      event: { kind: "source-success", attempt: 0, maxAttempts: 3 },
    });
    expect(plan.action).toBe("preserve");
    expect(plan.requiresPullRequest).toBe(false);
    expect(plan.preserveLastKnownGood).toBe(true);
    expect(plan.recovery.status).toBe("preserved");
  });

  it("creates a blocked repository audit when any completion requirement fails", () => {
    const requirements = Object.fromEntries(
      repositoryAuditRequirementIds.map((id) => [
        id,
        { passed: true, detail: "verified" },
      ]),
    ) as Record<
      (typeof repositoryAuditRequirementIds)[number],
      { passed: boolean; detail: string }
    >;
    requirements["tuple-evidence"] = {
      passed: false,
      detail: "one boundary remains blocked",
    };
    const audit = buildMaintenanceAudit({
      generatedAt: "2026-08-10T00:00:00.000Z",
      requirements,
    });
    expect(audit.status).toBe("blocked");
    expect(audit.blockers).toEqual([
      "tuple-evidence: one boundary remains blocked",
    ]);
    expect(audit.requirements).toHaveLength(20);
  });

  it("passes all recovery simulations without deleting historical content", () => {
    const scenarios = [
      "new-component",
      "new-boundary",
      "outage",
      "empty-response",
      "bulk-removal",
      "artifact-mutation",
      "transient-build",
      "template-failure",
      "historical-rebuild",
    ] as const;
    for (const scenario of scenarios) {
      const report = simulateRecovery(scenario);
      expect(report.status).toBe("passed");
      expect(report.steps.length).toBeGreaterThan(0);
      if (
        [
          "empty-response",
          "bulk-removal",
          "artifact-mutation",
          "template-failure",
        ].includes(scenario)
      )
        expect(report.preserved).toBe(true);
      if (
        [
          "empty-response",
          "bulk-removal",
          "artifact-mutation",
          "template-failure",
        ].includes(scenario)
      )
        expect(report.action).toBe("quarantine");
      if (scenario === "new-boundary") expect(report.action).toBe("review");
    }
  });

  it("uses stable identity digests independent of generated time", () => {
    const input = {
      sourceFamily: "forge",
      baseline,
      candidate,
      reconciliation: reconciliation({ addedCoordinates: ["a"] }),
      event: { kind: "source-success" as const, attempt: 0, maxAttempts: 3 },
    };
    const first = buildMaintenancePlan({
      ...input,
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    const second = buildMaintenancePlan({
      ...input,
      generatedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(first.planId).toBe(second.planId);
    expect(canonicalJson({ ...first, generatedAt: "" })).not.toContain(
      "undefined",
    );
  });

  it("matches the maintenance schemas", async () => {
    const registry = await createSchemaRegistry();
    const requirements = Object.fromEntries(
      repositoryAuditRequirementIds.map((id) => [
        id,
        { passed: true, detail: "verified" },
      ]),
    ) as Parameters<typeof buildMaintenanceAudit>[0]["requirements"];
    const audit = buildMaintenanceAudit({
      generatedAt: "2026-08-10T00:00:00.000Z",
      requirements,
    });
    expect(validateWithSchema(registry, audit).valid).toBe(true);
    const plan = buildMaintenancePlan({
      sourceFamily: "forge",
      generatedAt: "2026-08-10T00:00:00.000Z",
      baseline,
      candidate,
      reconciliation: reconciliation({ addedCoordinates: ["a"] }),
      event: { kind: "source-success", attempt: 0, maxAttempts: 3 },
    });
    expect(validateWithSchema(registry, plan).valid).toBe(true);
    expect(
      validateWithSchema(registry, simulateRecovery("historical-rebuild"))
        .valid,
    ).toBe(true);
  });
});
