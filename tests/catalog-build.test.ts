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

function snapshot(entries: SourceSnapshot["entries"]): SourceSnapshot {
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
        requestedUrl: "https://files.minecraftforge.net/maven/metadata.xml",
        url: "https://files.minecraftforge.net/maven/metadata.xml",
        redirectChain: ["https://files.minecraftforge.net/maven/metadata.xml"],
        retrievedAt: "2026-08-10T00:00:00.000Z",
        contentType: "application/xml",
        sha256: "0".repeat(64),
        bytes: 1,
      },
    ],
    entries,
    rejected: [],
    warnings: [],
  };
}

function input(entries: SourceSnapshot["entries"]): SnapshotInput {
  return {
    path: "sources/snapshots/forge/test.json",
    snapshot: snapshot(entries),
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
    expect(result.coverage.platforms[0]?.unexplainedGaps).toEqual([]);
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
  });

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

  it("does not recommend a discovered component before tuple verification", () => {
    const component: CatalogComponent = {
      id: "component.forge.test",
      component: "loader",
      version: "1.20.1-47.7.0",
      coordinate: "net.minecraftforge:forge:1.20.1-47.7.0",
      channel: "release",
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
