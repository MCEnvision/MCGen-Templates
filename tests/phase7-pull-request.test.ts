import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";
import { sha256 } from "../src/digest.js";
import {
  buildMaintenancePlan,
  type MaintenancePlan,
} from "../src/phase7-maintenance.js";
import { buildMonitorRun } from "../src/phase7-monitor.js";
import { buildMaintenancePullRequest } from "../src/phase7-pull-request.js";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";

const digest = (value: string): string => value.repeat(64);

function plan(): MaintenancePlan {
  return buildMaintenancePlan({
    sourceFamily: "forge",
    generatedAt: "2026-08-10T00:00:00.000Z",
    baseline: { id: "forge-baseline", digest: digest("a") },
    candidate: { id: "forge-candidate", digest: digest("b") },
    reconciliation: {
      previousSnapshotId: "forge-baseline",
      candidateSnapshotId: "forge-candidate",
      addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.3.0"],
      removedCoordinates: [],
      changedSources: [
        {
          sourceId: "forge-maven",
          previousSha256: digest("c"),
          candidateSha256: digest("d"),
        },
      ],
      requiresReview: true,
    },
    event: { kind: "source-success", attempt: 0, maxAttempts: 3 },
    affectedTuples: ["tuple-a"],
  });
}

function monitor() {
  return buildMonitorRun({
    sourceFamily: "forge",
    adapterId: "forge-maven",
    generatedAt: "2026-08-10T00:00:00.000Z",
    baseline: { id: "forge-baseline", digest: digest("a") },
    candidate: { id: "forge-candidate", digest: digest("b") },
    outcome: "source-mutation",
    changedSources: [
      {
        sourceId: "forge-maven",
        previousDigest: digest("c"),
        candidateDigest: digest("d"),
      },
    ],
    addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.3.0"],
    affectedTuples: ["tuple-a"],
  });
}

describe("phase 7 maintenance pull request manifests", () => {
  it("materializes deltas, blast radius, coverage, evidence, and review policy", async () => {
    const result = buildMaintenancePullRequest({
      plan: plan(),
      monitor: monitor(),
      invalidation: {
        planId: digest("e"),
        sourceFamily: "forge",
        tupleIds: ["tuple-a"],
        summary: {
          changedSourceCount: 1,
          invalidatedEvidenceCount: 1,
          invalidatedTupleCount: 1,
          queueShardCount: 1,
        },
      },
      coverage: {
        baseline: { total: 10, verified: 8, unresolved: 2 },
        candidate: { total: 11, verified: 9, unresolved: 2 },
        blockers: [],
      },
      generatedAt: "2026-08-10T00:00:00.000Z",
      profileIds: ["forge-modern"],
      changedPaths: [
        "sources/snapshots/forge/forge-candidate.json",
        "catalog/2026-08-10-r4/index.json",
      ],
    });
    expect(result.status).toBe("ready-for-review");
    expect(result.sourceDelta.changedSources).toHaveLength(1);
    expect(result.catalogDelta.addedCoordinates).toEqual([
      "net.minecraftforge:forge:1.20.1-47.3.0",
    ]);
    expect(result.blastRadius.profiles).toEqual(["forge-modern"]);
    expect(result.blastRadius.tuples).toEqual(["tuple-a"]);
    expect(result.evidence.invalidatedTupleIds).toEqual(["tuple-a"]);
    expect(result.coverage.delta).toEqual({
      total: 1,
      verified: 1,
      unresolved: 0,
    });
    expect(result.changedFiles.map((file) => file.area)).toEqual([
      "catalog",
      "source",
    ]);
    expect(result.publication.remoteWrites).toBe(false);
    expect(result.publication.createPullRequest).toBe(true);
    expect(result.publication.autoMerge).toBe(false);
    expect(result.publication.majorBoundaryReviewRequired).toBe(true);
    expect(validateWithSchema(await createSchemaRegistry(), result).valid).toBe(
      true,
    );
  });

  it("deduplicates equivalent changes and blocks incomplete or unsafe requests", () => {
    const input = {
      plan: plan(),
      monitor: monitor(),
      generatedAt: "2026-08-10T00:00:00.000Z",
      profileIds: ["forge-modern"],
      changedPaths: ["catalog/2026-08-10-r4/index.json"],
    } as const;
    const first = buildMaintenancePullRequest(input);
    const second = buildMaintenancePullRequest({
      ...input,
      generatedAt: "2026-08-11T00:00:00.000Z",
    });
    expect(first.deduplicationKey).toBe(second.deduplicationKey);
    expect(first.branchName).toBe(second.branchName);
    expect(first.pullRequestId).toBe(second.pullRequestId);
    expect(first.digest).not.toBe(second.digest);

    const incomplete = buildMaintenancePullRequest({
      plan: plan(),
      generatedAt: input.generatedAt,
    });
    expect(incomplete.status).toBe("blocked");
    expect(incomplete.blockers).toContain(
      "monitor run is required to materialize source and catalog deltas",
    );
    expect(incomplete.publication.createPullRequest).toBe(false);
    expect(() =>
      buildMaintenancePullRequest({
        ...input,
        changedPaths: ["../catalog/index.json"],
      }),
    ).toThrow(/unsafe/u);
  });

  it("rejects monitor and plan snapshot mismatches", () => {
    expect(() =>
      buildMaintenancePullRequest({
        plan: plan(),
        monitor: buildMonitorRun({
          ...monitor(),
          baseline: { id: "other-baseline", digest: digest("a") },
        }),
        generatedAt: "2026-08-10T00:00:00.000Z",
      }),
    ).toThrow(/baseline does not match/u);
    expect(sha256(canonicalJson([]))).toHaveLength(64);
  });
});
