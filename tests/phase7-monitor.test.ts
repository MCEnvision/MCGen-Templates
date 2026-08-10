import { describe, expect, it } from "vitest";
import {
  buildMonitorRun,
  buildQuarantineRecord,
  classifyMonitorEvent,
  isQuarantineRequired,
  type MonitorObservation,
} from "../src/phase7-monitor.js";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";

const digest = (character: string): string => character.repeat(64);

function observation(
  overrides: Partial<MonitorObservation> = {},
): MonitorObservation {
  return {
    sourceFamily: "forge",
    adapterId: "forge-maven",
    generatedAt: "2026-08-10T00:00:00.000Z",
    baseline: { id: "forge.2026-08-09", digest: digest("a") },
    candidate: { id: "forge.2026-08-10", digest: digest("b") },
    ...overrides,
  };
}

describe("phase 7 upstream monitor contracts", () => {
  it("classifies an additive candidate without destructive actions", () => {
    const run = buildMonitorRun(
      observation({
        outcome: "additions",
        addedCoordinates: [
          "net.minecraftforge:forge:1.20.1-47.2.0",
          "net.minecraftforge:forge:1.20.1-47.2.0",
        ],
      }),
    );
    expect(run.classification).toBe("additive");
    expect(run.policy).toEqual({
      proposeCandidate: true,
      requiresPullRequest: true,
      preserveLastKnownGood: true,
      publicationBlocked: true,
    });
    expect(run.addedCoordinates).toEqual([
      "net.minecraftforge:forge:1.20.1-47.2.0",
    ]);
    expect(run.quarantineId).toBeUndefined();
  });

  it("retains changed catalog coordinates in schema valid monitor evidence", async () => {
    const run = buildMonitorRun(
      observation({
        outcome: "additions",
        addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.2.0"],
        changedCoordinates: ["net.minecraftforge:forge:1.20.1-47.2.0"],
      }),
    );
    expect(run.changedCoordinates).toEqual([
      "net.minecraftforge:forge:1.20.1-47.2.0",
    ]);
    expect(run.classification).toBe("review");
    expect(validateWithSchema(await createSchemaRegistry(), run).valid).toBe(
      true,
    );
  });

  it("turns an exhausted transient outage into review without deleting baseline", () => {
    const run = buildMonitorRun(
      observation({
        candidate: null,
        outcome: "source-unavailable",
        attempt: 3,
        maxAttempts: 3,
      }),
    );
    expect(run.classification).toBe("review");
    expect(run.retry).toEqual({
      attempt: 3,
      maxAttempts: 3,
      eligible: false,
      backoffSeconds: [],
    });
    expect(run.policy.preserveLastKnownGood).toBe(true);
    expect(run.policy.publicationBlocked).toBe(true);
  });

  it("bounds transient retries and uses stable backoff values", () => {
    expect(
      classifyMonitorEvent({
        outcome: "transient-network-failure",
        attempt: 1,
        maxAttempts: 3,
      }),
    ).toBe("retry");
    const run = buildMonitorRun(
      observation({
        candidate: null,
        outcome: "transient-network-failure",
        attempt: 1,
        maxAttempts: 3,
      }),
    );
    expect(run.retry.backoffSeconds).toEqual([1, 5, 30]);
  });

  it("reviews source mutations without quarantining them", async () => {
    const first = buildMonitorRun(
      observation({
        generatedAt: "2026-08-10T00:00:00.000Z",
        changedSources: [
          {
            sourceId: "forge-maven",
            previousSha256: digest("a"),
            candidateSha256: digest("b"),
          },
        ],
      }),
    );
    const second = buildMonitorRun(
      observation({
        generatedAt: "2026-08-11T00:00:00.000Z",
        changedSources: [
          {
            sourceId: "forge-maven",
            previousSha256: digest("a"),
            candidateSha256: digest("b"),
          },
        ],
      }),
    );
    expect(first.outcome).toBe("source-mutation");
    expect(first.classification).toBe("review");
    expect(first.quarantineId).toBeUndefined();
    expect(first.runId).toBe(second.runId);
    expect(validateWithSchema(await createSchemaRegistry(), first).valid).toBe(
      true,
    );
  });

  it("infers source mutations from reconciliation input", () => {
    const run = buildMonitorRun(
      observation({
        reconciliation: {
          addedCoordinates: [],
          removedCoordinates: [],
          changedSources: [
            {
              sourceId: "forge-maven",
              previousSha256: digest("a"),
              candidateSha256: digest("b"),
            },
          ],
        },
      }),
    );
    expect(run.outcome).toBe("source-mutation");
    expect(run.classification).toBe("review");
  });

  it("creates a content addressed quarantine record for bulk removal", async () => {
    const run = buildMonitorRun(
      observation({
        outcome: "bulk-removal",
        removedCoordinates: ["net.minecraftforge:forge:1.20.1-47.1.0"],
        affectedTuples: ["forge-1.20.1-47.1.0"],
      }),
    );
    expect(isQuarantineRequired(run.outcome)).toBe(true);
    expect(run.classification).toBe("quarantine");
    const record = buildQuarantineRecord(run);
    expect(record.preserveLastKnownGood).toBe(true);
    expect(record.publicationBlocked).toBe(true);
    expect(record.status).toBe("open");
    expect(record.affectedCoordinates).toEqual([
      "net.minecraftforge:forge:1.20.1-47.1.0",
    ]);
    const registry = await createSchemaRegistry();
    expect(validateWithSchema(registry, run).valid).toBe(true);
    expect(validateWithSchema(registry, record).valid).toBe(true);
  });

  it("does not permit quarantine records for safe additions", () => {
    const run = buildMonitorRun(
      observation({
        outcome: "additions",
        addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.2.0"],
      }),
    );
    expect(() => buildQuarantineRecord(run)).toThrow(
      "does not require quarantine",
    );
  });

  it("rejects a boundary observation without a candidate snapshot", () => {
    expect(() =>
      buildMonitorRun(
        observation({ candidate: null, outcome: "compatibility-boundary" }),
      ),
    ).toThrow("requires a candidate snapshot");
  });

  it("rejects contradictory explicit outcomes and detects digest-only changes", () => {
    expect(() =>
      buildMonitorRun(
        observation({
          outcome: "unchanged",
          addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.2.0"],
        }),
      ),
    ).toThrow("contradicts observed deltas");
    const run = buildMonitorRun(
      observation({
        addedCoordinates: [],
        removedCoordinates: [],
      }),
    );
    expect(run.outcome).toBe("source-mutation");
    expect(run.classification).toBe("review");
  });
});
