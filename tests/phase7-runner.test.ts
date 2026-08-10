import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "../src/schema-registry.js";
import { listSourceAdapters } from "../src/source-adapters.js";
import { runSourceMonitoring } from "../src/phase7-runner.js";
import type { SourceSnapshot } from "../src/contracts.js";

async function loadBaselines(): Promise<Map<string, SourceSnapshot>> {
  const index = JSON.parse(
    await readFile(
      `${repositoryRoot}/catalog/2026-08-10-r4/index.json`,
      "utf8",
    ),
  ) as { sourceSnapshots: { path: string }[] };
  const snapshots = new Map<string, SourceSnapshot>();
  for (const reference of index.sourceSnapshots) {
    const snapshot = JSON.parse(
      await readFile(`${repositoryRoot}/${reference.path}`, "utf8"),
    ) as SourceSnapshot;
    snapshots.set(snapshot.adapter.id, snapshot);
  }
  return snapshots;
}

describe("phase 7 source runner", () => {
  it("monitors every registered adapter and preserves an unchanged baseline", async () => {
    const baselines = await loadBaselines();
    const result = await runSourceMonitoring({
      baselineCatalogPath: "catalog/2026-08-10-r4/index.json",
      candidateDirectory: "verification/phase7/test-candidates",
      monitorDirectory: "verification/phase7/test-monitors",
      generatedAt: "2026-08-10T00:00:00.000Z",
      capture: (adapter) => {
        const snapshot = baselines.get(adapter.adapterId);
        if (!snapshot) throw new Error(`missing ${adapter.adapterId}`);
        if (adapter.id !== "forge") return Promise.resolve(snapshot);
        return Promise.resolve({
          ...snapshot,
          createdAt: "2026-08-11T00:00:00.000Z",
          sources: snapshot.sources.map((source) => ({
            ...source,
            retrievedAt: "2026-08-11T00:00:00.000Z",
          })),
        });
      },
    });
    expect(result.run.adapters).toHaveLength(listSourceAdapters().length);
    expect(result.run.candidateComplete).toBe(true);
    expect(result.run.publicationBlocked).toBe(false);
    expect(result.candidates).toHaveLength(0);
    expect(
      result.monitors.every(
        ({ document }) => document.classification === "no-change",
      ),
    ).toBe(true);
    const registry = await createSchemaRegistry();
    expect(validateWithSchema(registry, result.run).valid).toBe(true);
    for (const monitor of result.monitors)
      expect(validateWithSchema(registry, monitor.document).valid).toBe(true);
  });

  it("keeps partial candidates blocked and records adapter failures", async () => {
    const baselines = await loadBaselines();
    const result = await runSourceMonitoring({
      baselineCatalogPath: "catalog/2026-08-10-r4/index.json",
      candidateDirectory: "verification/phase7/test-candidates",
      monitorDirectory: "verification/phase7/test-monitors",
      generatedAt: "2026-08-10T00:00:00.000Z",
      capture: (adapter) => {
        if (adapter.id === "paper")
          return Promise.reject(new Error("source unavailable"));
        const snapshot = baselines.get(adapter.adapterId);
        if (!snapshot)
          return Promise.reject(new Error(`missing ${adapter.adapterId}`));
        if (adapter.id !== "forge") return Promise.resolve(snapshot);
        const first = snapshot.entries[0];
        if (!first) return Promise.resolve(snapshot);
        return Promise.resolve({
          ...snapshot,
          entries: [
            ...snapshot.entries,
            {
              ...first,
              version: `${first.version}.candidate`,
              coordinate: `${first.coordinate}:candidate`,
            },
          ],
        });
      },
    });
    expect(result.run.candidateComplete).toBe(false);
    expect(result.run.publicationBlocked).toBe(true);
    expect(result.run.failedAdapters).toEqual(["paper"]);
    expect(
      result.candidates.some(({ path }) => path.endsWith("/forge.json")),
    ).toBe(true);
    const forge = result.monitors.find(
      ({ document }) => document.sourceFamily === "forge",
    );
    expect(forge?.document.classification).toBe("additive");
    const paper = result.monitors.find(
      ({ document }) => document.sourceFamily === "paper",
    );
    expect(paper?.document.outcome).toBe("source-unavailable");
    expect(canonicalJson(result.run)).toContain("candidateComplete");
  });

  it("rejects baseline catalogs that escape the repository or snapshot root", async () => {
    await expect(
      runSourceMonitoring({
        baselineCatalogPath: "../package.json",
        candidateDirectory: "verification/phase7/test-candidates",
        monitorDirectory: "verification/phase7/test-monitors",
        generatedAt: "2026-08-10T00:00:00.000Z",
        capture: () => Promise.reject(new Error("capture must not run")),
      }),
    ).rejects.toThrow("baseline catalog path is invalid");
  });
});
