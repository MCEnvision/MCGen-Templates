import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createEvidenceRecord } from "../src/evidence.js";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";
import { buildInvalidationPlan } from "../src/phase7-invalidation.js";
import type {
  TupleEvidenceRecord,
  TupleIdentity,
} from "../src/phase5-contracts.js";

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

function evidence(sourceDigests: readonly string[]): TupleEvidenceRecord {
  const identity: TupleIdentity = {
    family: "forge",
    descriptorId: "forge",
    descriptorRevision: 1,
    profileId: "forge",
    profileRevision: 1,
    catalogSnapshotId: "catalog.snapshot",
    catalogKey: "1.20.1",
    components: { forge: "47.3.0" },
    fixtureId: "fixture",
    sourceLanguage: "java",
    buildSystem: "gradle",
    gradleDsl: "groovy",
    contentDigests: {
      descriptor: digest("d"),
      profile: digest("p"),
      catalog: digest("c"),
      fixture: digest("f"),
      template: digest("t"),
    },
    java: { distribution: "temurin", runtime: 21 },
    wrapper: { version: "8.10", sha256: digest("w") },
    mappingDigest: digest("m"),
    sourceDigests,
    procedureDigest: digest("r"),
  };
  return createEvidenceRecord({
    identity,
    status: "blocked",
    generatedAt: "2026-08-10T00:00:00.000Z",
    generatorDigest: digest("g"),
    profileRevision: 1,
    descriptorRevision: 1,
    blockers: ["fixture is intentionally blocked"],
  });
}

describe("phase 7 evidence invalidation planning", () => {
  it("maps old source digests to evidence and bounded invalidation shards", async () => {
    const oldDigest = digest("a");
    const changed = buildInvalidationPlan({
      monitor: {
        runId: digest("r"),
        generatedAt: "2026-08-10T00:00:00.000Z",
        sourceFamily: "forge",
        changedSources: [
          {
            sourceId: "forge-maven-metadata",
            previousDigest: oldDigest,
            candidateDigest: digest("b"),
          },
        ],
      },
      evidence: [evidence([oldDigest]), evidence([digest("c")])],
      shardCount: 3,
      changedPaths: ["sources/snapshots/forge/candidate.json"],
    });

    expect(changed.status).toBe("invalidated");
    expect(changed.evidence).toHaveLength(1);
    expect(changed.tupleIds).toEqual([changed.evidence[0]?.evidenceId]);
    expect(changed.queuePlans).toHaveLength(3);
    expect(changed.queuePlans.flatMap((plan) => plan.tupleIds)).toEqual(
      changed.tupleIds,
    );
    expect(changed.summary).toMatchObject({
      changedSourceCount: 1,
      invalidatedEvidenceCount: 1,
      invalidatedTupleCount: 1,
      queueShardCount: 3,
    });
    const registry = await createSchemaRegistry();
    expect(validateWithSchema(registry, changed).valid).toBe(true);
  });

  it("keeps no change runs empty and does not schedule verification", () => {
    const plan = buildInvalidationPlan({
      monitor: {
        runId: digest("r"),
        generatedAt: "2026-08-10T00:00:00.000Z",
        sourceFamily: "forge",
        changedSources: [],
      },
      evidence: [evidence([digest("a")])],
      shardCount: 2,
    });
    expect(plan.status).toBe("no-change");
    expect(plan.evidence).toEqual([]);
    expect(plan.tupleIds).toEqual([]);
    expect(plan.queuePlans).toEqual([]);
    expect(plan.summary.invalidatedEvidenceCount).toBe(0);
  });

  it("maps one evidence record to every changed source it contains", () => {
    const first = digest("a");
    const second = digest("b");
    const plan = buildInvalidationPlan({
      monitor: {
        runId: digest("r"),
        generatedAt: "2026-08-10T00:00:00.000Z",
        sourceFamily: "fabric",
        changedSources: [
          {
            sourceId: "fabric-meta-game",
            previousDigest: first,
            candidateDigest: digest("c"),
          },
          {
            sourceId: "fabric-meta-loader",
            previousDigest: second,
            candidateDigest: digest("d"),
          },
        ],
      },
      evidence: [evidence([first, second])],
      shardCount: 1,
    });
    expect(plan.evidence[0]?.matchedSourceIds).toEqual([
      "fabric-meta-game",
      "fabric-meta-loader",
    ]);
    expect(plan.changedSources.map((source) => source.evidenceCount)).toEqual([
      1, 1,
    ]);
  });

  it("keeps the plan identity stable when only generation time changes", () => {
    const monitor = {
      runId: digest("r"),
      sourceFamily: "forge",
      changedSources: [
        {
          sourceId: "forge-maven-metadata",
          previousDigest: digest("a"),
          candidateDigest: digest("b"),
        },
      ],
    };
    const first = buildInvalidationPlan({
      monitor: { ...monitor, generatedAt: "2026-08-10T00:00:00.000Z" },
      evidence: [evidence([digest("a")])],
      shardCount: 1,
    });
    const second = buildInvalidationPlan({
      monitor: { ...monitor, generatedAt: "2026-08-11T00:00:00.000Z" },
      evidence: [evidence([digest("a")])],
      shardCount: 1,
    });
    expect(first.planId).toBe(second.planId);
    expect(first.digest).not.toBe(second.digest);
  });
});
