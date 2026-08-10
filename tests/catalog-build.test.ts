import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCatalog } from "../src/catalog/build.js";
import { buildCoverageReport } from "../src/catalog/coverage.js";
import { buildCatalogDriftReport } from "../src/catalog/drift.js";
import { recommendedComponent } from "../src/catalog/recommendation.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "../src/schema-registry.js";
import { canonicalJson } from "../src/canonical-json.js";
import { validateFiles } from "../src/validate.js";
import type { SourceSnapshot } from "../src/contracts.js";
import type {
  CatalogComponent,
  SnapshotInput,
} from "../src/catalog/contracts.js";

const forgeSnapshotUrl = new URL(
  "../sources/snapshots/forge/2026-08-09.json",
  import.meta.url,
);

function outputDocuments(result: ReturnType<typeof buildCatalog>) {
  const outputRoot = result.index.recommendationPolicy.path.replace(
    /\/recommendation-policy\.json$/u,
    "",
  );
  return [
    { path: `${outputRoot}/index.json`, document: result.index },
    { path: result.index.recommendationPolicy.path, document: result.policy },
    { path: result.index.coverage.path, document: result.coverage },
    ...result.platformIndexes.map((document) => ({
      path: `${outputRoot}/platforms/${document.platform}/index.json`,
      document,
    })),
    ...result.shards,
  ];
}

function snapshot(
  entries: SourceSnapshot["entries"],
  rejected: SourceSnapshot["rejected"] = [],
): SourceSnapshot {
  return {
    $schema: "urn:mcgen:schema:source-snapshot:1",
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: "forge.test",
    adapter: { id: "forge-maven", version: "1.0.2" },
    createdAt: "2026-08-10T00:00:00.000Z",
    sources: [
      {
        sourceId: "forge-maven-metadata",
        role: "primary",
        requestedUrl:
          "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
        url: "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
        redirectChain: [
          "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
        ],
        retrievedAt: "2026-08-10T00:00:00.000Z",
        contentType: "application/xml",
        sha256: "0".repeat(64),
        bytes: 1,
      },
    ],
    entries,
    rejected,
    warnings: [],
  };
}

function input(
  entries: SourceSnapshot["entries"],
  rejected: SourceSnapshot["rejected"] = [],
): SnapshotInput {
  return {
    path: "sources/snapshots/forge/test.json",
    snapshot: snapshot(entries, rejected),
  };
}

const entries: SourceSnapshot["entries"] = [
  {
    platform: "forge",
    component: "loader",
    catalogKey: "1.20.1",
    version: "1.20.1-47.6.0",
    coordinate: "net.minecraftforge:forge:1.20.1-47.6.0",
    channel: "release",
    sourceIndexes: [0],
  },
  {
    platform: "forge",
    component: "loader",
    catalogKey: "1.20.1",
    version: "1.20.1-47.7.0",
    coordinate: "net.minecraftforge:forge:1.20.1-47.7.0",
    channel: "release",
    sourceIndexes: [0],
  },
];

function catalog(entriesToBuild = entries) {
  return buildCatalog({
    snapshots: [input(entriesToBuild)],
    categoryByPlatform: { forge: "mod" },
    keyKindByPlatform: { forge: "minecraft" },
  });
}

describe("deterministic compatibility catalog", () => {
  it("creates one exact component edge per observed source entry, not a cartesian product", () => {
    const result = catalog();
    const shard = result.shards[0]?.document;
    expect(shard?.components).toHaveLength(2);
    expect(shard?.edges).toHaveLength(2);
    expect(shard?.components.map((component) => component.status)).toEqual([
      "discovered",
      "discovered",
    ]);
    expect(result.coverage.platforms[0]?.represented).toBe(2);
    expect(result.coverage.coverageMappingVersion).toBe(1);
    expect(result.coverage.platforms[0]?.statuses).toEqual({ blocked: 2 });
    const blockedEntry = result.coverage.platforms[0]?.entries.find(
      (entry) => entry.verificationStatus === "blocked",
    );
    expect(blockedEntry?.componentId).toMatch(/^component\.forge\./u);
    expect(blockedEntry?.resolution.kind).toBe("blocker");
    if (blockedEntry?.resolution.kind !== "blocker")
      throw new Error("catalog fixture did not create a component blocker");
    expect(
      blockedEntry.resolution.blockerId.startsWith("blocker.component."),
    ).toBe(true);
    expect(result.coverage.platforms[0]?.unexplainedGaps).toEqual([]);
  });

  it("maps exact evidence and leaves uncovered components explicitly blocked", () => {
    const result = buildCatalog({
      snapshots: [input(entries)],
      categoryByPlatform: { forge: "mod" },
      keyKindByPlatform: { forge: "minecraft" },
      coverageEvidence: [
        {
          tupleId: "1".repeat(64),
          evidencePath: "verification/phase5/evidence/forge.json",
          evidenceDigest: "2".repeat(64),
          status: "verified",
          family: "forge",
          catalogKey: "1.20.1",
          components: { forge: entries[0]?.coordinate ?? "" },
        },
      ],
    });
    const platform = result.coverage.platforms[0];
    expect(platform?.statuses).toEqual({ blocked: 1, verified: 1 });
    const verifiedEntry = platform?.entries.find(
      (entry) => entry.verificationStatus === "verified",
    );
    expect(verifiedEntry?.resolution.kind).toBe("exact-evidence");
    if (verifiedEntry?.resolution.kind !== "exact-evidence")
      throw new Error(
        "catalog fixture did not create an exact evidence mapping",
      );
    const evidence = verifiedEntry.resolution.evidence[0];
    expect(evidence?.tupleId).toBe("1".repeat(64));
    expect(evidence?.evidencePath).toBe(
      "verification/phase5/evidence/forge.json",
    );
    expect(evidence?.evidenceDigest).toBe("2".repeat(64));
    expect(evidence?.status).toBe("verified");
    const blockedEntry = platform?.entries.find(
      (entry) => entry.verificationStatus === "blocked",
    );
    expect(blockedEntry?.resolution.kind).toBe("blocker");
  });

  it("is byte deterministic for identical source snapshots", () => {
    const first = catalog();
    const second = catalog();
    expect(first).toEqual(second);
  });

  it("keeps global source discoveries outside compatibility targets", () => {
    const firstEntry = entries[0];
    if (!firstEntry) throw new Error("catalog fixture omitted its first entry");
    const result = buildCatalog({
      snapshots: [
        input([
          {
            ...firstEntry,
            component: "build-plugin",
            catalogKey: "all",
            version: "7.0.0",
            coordinate: "example:plugin:7.0.0",
          },
        ]),
      ],
      categoryByPlatform: { forge: "mod" },
      keyKindByPlatform: { forge: "minecraft" },
    });
    const shard = result.shards[0]?.document;
    expect(shard).toMatchObject({ key: "all", keyKind: "global", edges: [] });
  });

  it("preserves unresolved source discoveries without inventing a compatibility target", () => {
    const firstEntry = entries[0];
    if (!firstEntry) throw new Error("catalog fixture omitted its first entry");
    const result = buildCatalog({
      snapshots: [
        input([
          {
            ...firstEntry,
            catalogKey: "unresolved",
            compatibility: "unresolved",
            version: "24w14a",
            coordinate: "com.mojang:minecraft:24w14a",
            channel: "snapshot",
          },
        ]),
      ],
      categoryByPlatform: { forge: "mod" },
      keyKindByPlatform: { forge: "minecraft" },
    });
    const shard = result.shards[0]?.document;
    expect(shard).toMatchObject({
      key: "unresolved",
      keyKind: "unresolved",
      edges: [],
      components: [expect.objectContaining({ compatibility: "unresolved" })],
    });
  });

  it("validates every generated catalog document against its registered contract", async () => {
    const result = catalog();
    const registry = await createSchemaRegistry();
    const documents: unknown[] = [
      result.index,
      result.policy,
      result.coverage,
      ...result.platformIndexes,
      ...result.shards.map(({ document }) => document),
    ];
    for (const document of documents) {
      expect(validateWithSchema(registry, document)).toMatchObject({
        valid: true,
      });
    }
  });

  it("covers every committed Forge source entry in an exact catalog shard", async () => {
    const committed = JSON.parse(
      await readFile(forgeSnapshotUrl, "utf8"),
    ) as SourceSnapshot;
    const result = buildCatalog({
      snapshots: [
        {
          path: "sources/snapshots/forge/2026-08-09.json",
          snapshot: committed,
        },
      ],
      categoryByPlatform: { forge: "mod" },
      keyKindByPlatform: { forge: "minecraft" },
    });
    expect(result.shards).toHaveLength(77);
    expect(result.coverage.platforms).toEqual([
      expect.objectContaining({
        platform: "forge",
        discovered: 5033,
        represented: 5033,
        unexplainedGaps: [],
      }),
    ]);
  });

  it("validates catalog documents as one source backed immutable graph", async () => {
    const committed = JSON.parse(
      await readFile(forgeSnapshotUrl, "utf8"),
    ) as SourceSnapshot;
    await mkdir(resolve(repositoryRoot, "catalog"), { recursive: true });
    const directory = await mkdtemp(
      resolve(repositoryRoot, "catalog/.catalog-test-"),
    );
    try {
      const result = buildCatalog({
        snapshots: [
          {
            path: "sources/snapshots/forge/2026-08-09.json",
            snapshot: committed,
          },
        ],
        categoryByPlatform: { forge: "mod" },
        keyKindByPlatform: { forge: "minecraft" },
        outputRoot: relative(repositoryRoot, directory),
      });
      const documents = outputDocuments(result);
      for (const { path, document } of documents) {
        const absolute = resolve(repositoryRoot, path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, canonicalJson(document), "utf8");
      }
      const paths = [
        resolve(repositoryRoot, "sources/snapshots/forge/2026-08-09.json"),
        ...documents.map(({ path }) => resolve(repositoryRoot, path)),
      ];
      expect(await validateFiles(paths)).toEqual([]);

      const first = result.shards[0];
      if (!first) throw new Error("catalog fixture did not generate a shard");
      const invalid = structuredClone(first.document);
      const component = invalid.components[0];
      if (!component) throw new Error("catalog fixture shard has no component");
      component.status = "verified";
      await writeFile(
        resolve(repositoryRoot, first.path),
        canonicalJson(invalid),
        "utf8",
      );
      expect(await validateFiles(paths)).toContainEqual(
        expect.stringContaining("cannot support a recommendation"),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it("reports a source entry with no shard as an unexplained coverage gap", () => {
    const source = input(entries);
    const coverage = buildCoverageReport(
      "catalog.test",
      [{ input: source, digest: "0".repeat(64) }],
      [],
    );
    expect(coverage.platforms[0]?.represented).toBe(0);
    expect(coverage.platforms[0]?.unexplainedGaps).toHaveLength(2);
  });

  it("makes every rejected source record an exact coverage blocker", () => {
    const result = buildCatalog({
      snapshots: [
        input(entries, [
          {
            value: "1.20.1-47.bad",
            reason: "version does not match the published coordinate",
            sourceIndex: 0,
          },
        ]),
      ],
      categoryByPlatform: { forge: "mod" },
      keyKindByPlatform: { forge: "minecraft" },
    });
    const platform = result.coverage.platforms[0];
    expect(platform).toMatchObject({
      platform: "forge",
      discovered: 2,
      represented: 2,
      rejected: 1,
      unexplainedGaps: [],
    });
    const rejectedBlocker = platform?.blockers.find(
      (blocker) => blocker.rejectedEntries !== undefined,
    );
    expect(rejectedBlocker).toEqual(
      expect.objectContaining({
        reason: "version does not match the published coordinate",
        rejectedEntries: [
          {
            snapshotId: "forge.test",
            rejectedIndex: 0,
            sourceIndex: 0,
          },
        ],
      }),
    );
    expect(
      platform?.blockers.filter((blocker) =>
        blocker.id.startsWith("blocker.component."),
      ),
    ).toHaveLength(2);
    expect(result).toEqual(
      buildCatalog({
        snapshots: [
          input(entries, [
            {
              value: "1.20.1-47.bad",
              reason: "version does not match the published coordinate",
              sourceIndex: 0,
            },
          ]),
        ],
        categoryByPlatform: { forge: "mod" },
        keyKindByPlatform: { forge: "minecraft" },
      }),
    );
  });

  it("audits accepted and rejected snapshot totals against coverage", async () => {
    await mkdir(resolve(repositoryRoot, "catalog"), { recursive: true });
    const directory = await mkdtemp(
      resolve(repositoryRoot, "catalog/.catalog-coverage-test-"),
    );
    const sourceDirectory = await mkdtemp(
      resolve(
        repositoryRoot,
        "sources/snapshots/forge/.catalog-coverage-test-",
      ),
    );
    try {
      const sourcePath = relative(
        repositoryRoot,
        resolve(sourceDirectory, "snapshot.json"),
      );
      const source = input(entries, [
        {
          value: "malformed release",
          reason: "release metadata is malformed",
          sourceIndex: 0,
        },
      ]);
      source.path = sourcePath;
      const result = buildCatalog({
        snapshots: [source],
        categoryByPlatform: { forge: "mod" },
        keyKindByPlatform: { forge: "minecraft" },
        outputRoot: relative(repositoryRoot, directory),
      });
      const documents = outputDocuments(result);
      await writeFile(
        resolve(repositoryRoot, source.path),
        canonicalJson(source.snapshot),
        "utf8",
      );
      for (const { path, document } of documents) {
        const absolute = resolve(repositoryRoot, path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, canonicalJson(document), "utf8");
      }
      const paths = [
        resolve(repositoryRoot, source.path),
        ...documents.map(({ path }) => resolve(repositoryRoot, path)),
      ];
      expect(await validateFiles(paths)).toEqual([]);

      const invalid = structuredClone(result.coverage);
      const sourceSnapshot = invalid.sourceSnapshots.at(0);
      const blocker = invalid.platforms
        .at(0)
        ?.blockers.find((candidate) => candidate.rejectedEntries?.length === 1);
      if (!sourceSnapshot || !blocker) {
        throw new Error("catalog fixture did not create rejected coverage");
      }
      sourceSnapshot.rejected = 0;
      blocker.reason = "unrelated reason";
      await writeFile(
        resolve(repositoryRoot, result.index.coverage.path),
        canonicalJson(invalid),
        "utf8",
      );
      expect(await validateFiles(paths)).toContainEqual(
        expect.stringContaining(
          "coverage rejected totals do not match source snapshot",
        ),
      );
      expect(await validateFiles(paths)).toContainEqual(
        expect.stringContaining(
          "coverage blocker reason does not match the rejected source record",
        ),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
      await rm(sourceDirectory, { recursive: true, force: true });
    }
  });

  it("does not recommend a discovered component before tuple verification", () => {
    const component: CatalogComponent = {
      id: "component.forge.test",
      component: "loader",
      version: "1.20.1-47.7.0",
      coordinate: "net.minecraftforge:forge:1.20.1-47.7.0",
      channel: "release",
      compatibility: "declared",
      status: "discovered",
      sourceEntries: [
        { snapshotId: "forge.test", entryIndex: 0, sourceIndexes: [0] },
      ],
    };
    expect(recommendedComponent([component])).toBeUndefined();
    expect(
      recommendedComponent([
        { ...component, status: "verified", version: "1.20.1-47.6.0" },
        {
          ...component,
          id: "component.forge.newer",
          status: "verified",
          version: "1.20.1-47.7.0",
        },
      ]),
    ).toMatchObject({ version: "1.20.1-47.7.0" });
  });

  it("reports removals and source digest changes for review without deleting historical evidence", () => {
    const baseline = input(entries);
    const firstEntry = entries.at(0);
    if (!firstEntry)
      throw new Error("catalog test fixture omitted its first entry");
    const candidate = input([firstEntry]);
    candidate.snapshot.snapshotId = "forge.candidate";
    const firstSource = candidate.snapshot.sources.at(0);
    if (!firstSource)
      throw new Error("catalog test fixture omitted its source");
    candidate.snapshot.sources[0] = {
      ...firstSource,
      sha256: "1".repeat(64),
    };
    const report = buildCatalogDriftReport([baseline], [candidate]);
    expect(report.removed).toHaveLength(1);
    expect(report.changedSources).toHaveLength(1);
    expect(report.requiresReview).toBe(true);
  });
});
