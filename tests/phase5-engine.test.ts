import { describe, expect, it } from "vitest";
import {
  inspectArtifact,
  inspectArtifactEntries,
} from "../src/artifact-inspector.js";
import {
  runBuild,
  nodeCommandExecutor,
  rejectRawOverrideExecution,
  verifyJavaRuntime,
} from "../src/build-runner.js";
import { buildCoverageSummary } from "../src/coverage-summary.js";
import {
  createEvidenceRecord,
  evidenceReusable,
  invalidationReasons,
  validateEvidenceRecord,
} from "../src/evidence.js";
import { buildFixtureManifest } from "../src/fixture-generator.js";
import { buildMatrixPlan, validateMatrixPlan } from "../src/matrix-planner.js";
import { buildQueuePlan } from "../src/phase5-queue.js";
import { executeTuple } from "../src/phase5-execution.js";
import { compareReproducibleTrees } from "../src/reproducibility.js";
import { sha256 } from "../src/digest.js";
import { canonicalJson } from "../src/canonical-json.js";
import {
  validateWithSchema,
  createSchemaRegistry,
} from "../src/schema-registry.js";
import {
  validateBuildContract,
  type TupleIdentity,
} from "../src/phase5-contracts.js";

const png = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const identity: TupleIdentity = {
  family: "fabric",
  descriptorId: "fabric",
  descriptorRevision: 1,
  profileId: "fabric",
  profileRevision: 1,
  catalogSnapshotId: "2026-08-10-r4",
  catalogKey: "1.21.1",
  components: { loader: "net.fabricmc:fabric-loader:0.16.14" },
  fixtureId: "fabric.fabric.minimal-java",
  contentDigests: {
    descriptor: sha256("descriptor"),
    profile: sha256("profile"),
    catalog: sha256("catalog"),
    fixture: sha256("fixture"),
    template: sha256("template"),
  },
  java: { distribution: "temurin", runtime: 21, checksum: sha256("java") },
  wrapper: { version: "8.8", sha256: sha256("wrapper") },
  mappingDigest: sha256("mappings"),
  sourceDigests: [sha256("source")],
  procedureDigest: sha256("procedure"),
};

describe("phase 5 build and artifact contracts", () => {
  it("creates a deterministic fixture manifest for all version channels", () => {
    const input = {
      tuple: identity,
      languages: ["java", "kotlin"] as const,
      optionalFeatures: ["mixins"],
      multiloader: false,
    };
    const first = buildFixtureManifest(input);
    const second = buildFixtureManifest(input);
    expect(first).toEqual(second);
    expect(
      first.fixtures.some((fixture) => fixture.kind === "minimal-kotlin"),
    ).toBe(true);
    expect(first.fixtures.map((fixture) => fixture.version)).toEqual(
      expect.arrayContaining([
        "1.0-alpha.1",
        "1.0-beta.1",
        "1.0-rc.1",
        "1.0-SNAPSHOT",
        "1.0.0+build.1",
      ]),
    );
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("plans exact tuples and deterministic shards without guessing blocked profiles", () => {
    const profile = {
      id: "fabric",
      revision: 1,
      status: "blocked" as const,
      family: "fabric",
      platform: "fabric",
      catalogSnapshotId: identity.catalogSnapshotId,
      selectors: [
        {
          platform: "fabric",
          keys: { mode: "explicit" as const, values: ["1.21.1"] },
          components: [
            {
              component: "loader",
              coordinatePrefix: "net.fabricmc:fabric-loader:",
              mode: "explicit" as const,
              versions: ["net.fabricmc:fabric-loader:0.16.14"],
            },
          ],
        },
      ],
      java: identity.java,
      wrapper: identity.wrapper,
      mappingDigest: identity.mappingDigest,
      sourceDigests: identity.sourceDigests,
      contentDigests: {
        profile: sha256("profile"),
        catalog: sha256("catalog"),
        template: sha256("template"),
      },
      blockers: ["tuple build evidence is pending"],
    };
    const descriptor = {
      id: "fabric",
      revision: 1,
      status: "blocked" as const,
      family: "fabric",
      profileRefs: ["fabric"],
      contentDigests: { descriptor: sha256("descriptor") },
      blockers: ["descriptor evidence is pending"],
    };
    const input = {
      catalogKeys: { fabric: ["1.21.1"] },
      componentVersions: {},
      fixtureIds: [identity.fixtureId],
      profiles: [profile],
      descriptors: [descriptor],
      shardCount: 3,
      maxTuples: 10,
    };
    const first = buildMatrixPlan(input);
    expect(buildMatrixPlan(input)).toEqual(first);
    expect(first.tuples).toHaveLength(1);
    expect(first.tuples[0]?.status).toBe("blocked");
    expect(first.shards).toHaveLength(3);
    expect(first.shards.flatMap((shard) => shard.tuples)).toHaveLength(1);
    const scoped = buildMatrixPlan({
      ...input,
      fixtureIdsByProfile: { "fabric\u0000fabric": ["scoped-fixture"] },
    });
    expect(scoped.tuples[0]?.identity.fixtureId).toBe("scoped-fixture");
    const firstShard = first.shards.find((shard) => shard.tuples.length > 0);
    if (!firstShard) throw new Error("expected a populated matrix shard");
    const tuple = firstShard.tuples[0];
    if (!tuple) throw new Error("expected a matrix tuple");
    const altered = {
      ...first,
      shards: first.shards.map((shard) =>
        shard.index === firstShard.index
          ? {
              ...shard,
              tuples: shard.tuples.map((item, index) =>
                index === 0
                  ? { ...item, blockers: [...item.blockers, "tampered"] }
                  : item,
              ),
            }
          : shard,
      ),
    };
    expect(validateMatrixPlan(altered).join(" ")).toContain(
      "matrix shard tuple differs from top level",
    );
    expect(() =>
      buildMatrixPlan({
        ...input,
        profiles: [{ ...profile, status: "reviewed", blockers: [] }],
        descriptors: [{ ...descriptor, status: "reviewed", blockers: [] }],
        compatibility: [
          {
            platform: "fabric",
            catalogKey: "1.21.1",
            components: {
              loader: "net.fabricmc:fabric-loader:0.16.14",
            },
          },
        ],
      }),
    ).toThrow("immutable digest");
  });

  it("runs only bounded profile commands and rejects raw overrides", async () => {
    const calls: string[] = [];
    const result = await runBuild({
      contract: {
        java: identity.java,
        wrapper: identity.wrapper,
        commands: [
          { executable: "./gradlew", args: ["build"], purpose: "build" },
        ],
        workDirectoryPolicy: "isolated-clean",
        rawOverridePolicy: "never-execute",
        limits: {
          timeoutMs: 30_000,
          maxOutputBytes: 1_024,
          maxDiskBytes: 10_000,
          retries: 0,
          artifactRetentionDays: 1,
        },
      },
      workDirectory: "/tmp/mcgen-phase5-test",
      startedAt: "2026-08-10T00:00:00.000Z",
      execute: (command) => {
        calls.push(command.executable);
        return Promise.resolve({
          exitCode: 0,
          stdout: "ok",
          stderr: "",
          durationMs: 2,
        });
      },
    });
    expect(result.status).toBe("passed");
    expect(calls).toEqual(["./gradlew"]);
    expect(() => rejectRawOverrideExecution(true)).toThrow("never executable");
    expect(
      validateBuildContract({
        java: identity.java,
        wrapper: identity.wrapper,
        commands: [{ executable: "/bin/sh", args: [], purpose: "build" }],
        workDirectoryPolicy: "isolated-clean",
        rawOverridePolicy: "never-execute",
        limits: {
          timeoutMs: 30_000,
          maxOutputBytes: 1_024,
          maxDiskBytes: 10_000,
          retries: 0,
          artifactRetentionDays: 1,
        },
      }),
    ).toContain("unsafe executable for build");
  });

  it("parses legacy Java 8 version output correctly", () => {
    expect(() =>
      verifyJavaRuntime(8, 'java version "1.8.0_402"'),
    ).not.toThrow();
    expect(() => verifyJavaRuntime(17, 'java version "1.8.0_402"')).toThrow(
      "does not match profile 17",
    );
  });

  it("inspects metadata, classes, namespaces, icons, and secret absence", () => {
    const entries = [
      {
        path: "fabric.mod.json",
        content: Buffer.from('{"id":"example","version":"1.0.0"}'),
      },
      { path: "org/example/Main.class", content: new Uint8Array([1]) },
      { path: "assets/example/icon.png", content: png },
    ];
    const report = inspectArtifactEntries(
      "build/libs/example-1.0.0.jar",
      new Uint8Array([1, 2, 3]),
      entries,
      {
        patterns: ["build/libs/*.jar"],
        metadataPaths: ["fabric.mod.json"],
        requiredEntries: ["fabric.mod.json"],
        entrypointClasses: ["org.example.Main"],
        resourceNamespaces: ["example"],
        iconPaths: ["assets/example/icon.png"],
        expectedExtension: ".jar",
        projectIdentity: { id: "example", version: "1.0.0" },
      },
    );
    expect(report.status).toBe("passed");
    expect(report.failures).toEqual([]);
  });

  it("reuses only exact evidence and exposes invalidation", () => {
    const record = createEvidenceRecord({
      identity,
      status: "verified",
      generatedAt: "2026-08-10T00:00:00.000Z",
      generatorDigest: sha256("generator"),
      profileRevision: 1,
      descriptorRevision: 1,
      build: {
        status: "passed",
        startedAt: "2026-08-10T00:00:00.000Z",
        finishedAt: "2026-08-10T00:00:01.000Z",
        commands: [
          {
            command: ["./gradlew", "build"],
            exitCode: 0,
            durationMs: 1,
            outputDigest: sha256("output"),
          },
        ],
      },
      artifact: {
        status: "passed",
        path: "build/libs/example.jar",
        sha256: sha256("artifact"),
        bytes: 8,
        entries: ["example.mod.json"],
        metadata: [],
        failures: [],
        warnings: [],
      },
      outputTreeDigest: sha256("tree"),
      reproducibility: {
        reproducible: true,
        firstDigest: sha256("tree"),
        secondDigest: sha256("tree"),
        differences: [],
      },
      blockers: [],
    });
    expect(evidenceReusable(record, identity, sha256("generator"))).toBe(true);
    const changed = { ...identity, mappingDigest: sha256("changed") };
    expect(evidenceReusable(record, changed, sha256("generator"))).toBe(false);
    expect(invalidationReasons(record, changed, sha256("generator"))).toContain(
      "mappings changed",
    );
    const summary = buildCoverageSummary({
      catalogSnapshotId: identity.catalogSnapshotId,
      generatedAt: "2026-08-10T00:00:00.000Z",
      matrixDigest: sha256("matrix"),
      tuples: [
        {
          id: record.key.digest,
          status: "discovered",
          blockers: [],
          identity,
          profileRevision: 1,
          descriptorRevision: 1,
        },
      ],
      evidence: [record],
      generatorDigest: sha256("generator"),
    });
    expect(summary.counts.verified).toBe(1);
    expect(summary.total).toBe(1);
  });

  it("registers and validates generated phase 5 documents", async () => {
    const registry = await createSchemaRegistry();
    const fixture = buildFixtureManifest({
      tuple: identity,
      languages: ["java"],
      optionalFeatures: [],
      multiloader: false,
    });
    const fixtureValidation = validateWithSchema(registry, fixture);
    expect(
      fixtureValidation.valid,
      JSON.stringify(fixtureValidation.errors),
    ).toBe(true);
    const evidence = createEvidenceRecord({
      identity,
      status: "blocked",
      generatedAt: "2026-08-10T00:00:00.000Z",
      generatorDigest: sha256("generator"),
      profileRevision: 1,
      descriptorRevision: 1,
      blockers: ["pending"],
    });
    const evidenceValidation = validateWithSchema(registry, evidence);
    expect(
      evidenceValidation.valid,
      JSON.stringify(evidenceValidation.errors),
    ).toBe(true);
  });

  it("invalidates evidence when profile or descriptor revisions change", () => {
    const record = createEvidenceRecord({
      identity,
      status: "blocked",
      generatedAt: "2026-08-10T00:00:00.000Z",
      generatorDigest: sha256("generator"),
      profileRevision: 1,
      descriptorRevision: 1,
      blockers: ["blocked"],
    });
    const changed = { ...identity, profileRevision: 2 };
    expect(evidenceReusable(record, changed, sha256("generator"))).toBe(false);
    expect(invalidationReasons(record, changed, sha256("generator"))).toContain(
      "profile revision changed",
    );
  });

  it("rejects evidence whose invalidation contract is not identity bound", () => {
    const record = createEvidenceRecord({
      identity,
      status: "blocked",
      generatedAt: "2026-08-10T00:00:00.000Z",
      generatorDigest: sha256("generator"),
      profileRevision: 1,
      descriptorRevision: 1,
      blockers: ["blocked"],
    });
    const invalid = structuredClone(record);
    invalid.invalidation.mappingDigest = sha256("other-mappings");
    expect(validateEvidenceRecord(invalid)).toContain(
      "evidence mapping digest does not match tuple identity",
    );
  });

  it("compares reproducible trees and shards queue events deterministically", () => {
    const first = new Map([["a.txt", new Uint8Array([1])]]);
    const second = new Map([["a.txt", new Uint8Array([1])]]);
    expect(compareReproducibleTrees(first, second).reproducible).toBe(true);
    expect(
      compareReproducibleTrees(first, new Map([["a.txt", new Uint8Array([2])]]))
        .reproducible,
    ).toBe(false);
    const plan = buildQueuePlan({
      event: {
        queue: "changed-boundaries",
        subject: "fabric",
        changedPaths: ["profiles/fabric.json"],
        tupleIds: [sha256("a"), sha256("b")],
        createdAt: "2026-08-10T00:00:00.000Z",
      },
      shardCount: 2,
      shardIndex: 0,
    });
    expect(plan.$schema).toBe("urn:mcgen:schema:queue-plan:1");
    expect(plan.cancelKey).toContain("phase5-changed-boundaries");
  });

  it("rejects malformed zip artifacts before metadata inspection", () => {
    const report = inspectArtifact(
      "build/libs/example.jar",
      new Uint8Array([1, 2, 3]),
      {
        patterns: ["build/libs/*.jar"],
        metadataPaths: [],
        requiredEntries: [],
        entrypointClasses: [],
        resourceNamespaces: [],
        iconPaths: [],
        expectedExtension: ".jar",
      },
    );
    expect(report.status).toBe("failed");
    expect(report.failures.join(" ")).toContain("zip archive");
  });

  it("refuses blocked tuples and raw override execution before rendering", async () => {
    const request = {
      tuple: {
        id: sha256(canonicalJson(identity)),
        status: "discovered" as const,
        blockers: [],
        identity,
      },
      fixture: {
        tuple: identity,
        fixture: {
          id: "raw",
          kind: "raw-override" as const,
          language: "java" as const,
          version: "1.0.0",
          rawOverride: true,
        },
        descriptorPath: "templates/fabric/descriptor.json",
        spec: {} as never,
      },
      build: {} as never,
      artifact: {} as never,
      generatorDigest: sha256("generator"),
      parentDirectory: "/tmp/mcgen-phase5-test",
      reviewedProfile: {
        id: "fabric",
        digest: identity.contentDigests.profile,
        artifactDigest: sha256(canonicalJson({})),
      },
      generatedAt: "2026-08-10T00:00:00.000Z",
    };
    await expect(executeTuple(request)).rejects.toThrow(
      "raw override fixtures are validate only",
    );
    await expect(
      executeTuple({
        ...request,
        tuple: { ...request.tuple, status: "blocked", blockers: ["profile"] },
      }),
    ).rejects.toThrow("only discovered tuples");
  });

  it("executes a reviewed generated project through javac and jar", async () => {
    const builtIdentity: TupleIdentity = {
      ...identity,
      family: "bukkit",
      descriptorId: "bukkit",
      profileId: "bukkit",
      catalogKey: "1.21.1",
      components: { bukkit: "org.bukkit:bukkit:1.21.1" },
      fixtureId: "bukkit.built.minimal-java",
      java: { distribution: "temurin", runtime: 21 },
      wrapper: { version: "test-wrapper", sha256: sha256("test-wrapper") },
    };
    const expectation = {
      patterns: ["build/libs/*.jar"],
      metadataPaths: ["plugin.yml"],
      requiredEntries: ["plugin.yml"],
      entrypointClasses: ["org.example.ExamplePlugin"],
      resourceNamespaces: [],
      iconPaths: [],
      expectedExtension: ".jar" as const,
      projectIdentity: { id: "Example Plugin", version: "1.0.0" },
    };
    const spec = {
      $schema: "urn:mcgen:schema:project-spec:1" as const,
      schemaVersion: 1 as const,
      template: "plugin.bukkit",
      mode: "simple" as const,
      project: {
        name: "Example Plugin",
        id: "example",
        package: "org.example",
        mainClass: "ExamplePlugin",
        version: "1.0.0",
      },
      platform: {
        id: "bukkit",
        catalogKey: "1.21.1",
        components: { bukkit: "org.bukkit:bukkit:1.21.1" },
        java: 21,
      },
      metadata: {},
      build: { system: "gradle", dsl: "groovy" },
      dependencies: [],
      repositories: [],
      sourceLayout: {},
      features: [],
      assets: [],
      publishing: {},
      repository: {},
      targetOverrides: [],
      fileOperations: [],
      extensions: {},
    };
    const build = {
      java: builtIdentity.java,
      wrapper: builtIdentity.wrapper,
      commands: [
        {
          executable: "mkdir",
          args: ["-p", "build/classes"],
          purpose: "static-validation" as const,
        },
        {
          executable: "javac",
          args: [
            "-d",
            "build/classes",
            "src/main/java/org/example/ExamplePlugin.java",
          ],
          purpose: "build" as const,
        },
        {
          executable: "mkdir",
          args: ["-p", "build/libs"],
          purpose: "static-validation" as const,
        },
        {
          executable: "jar",
          args: [
            "--create",
            "-M",
            "--file",
            "build/libs/example.jar",
            "--date=2020-01-01T00:00:00Z",
            "-C",
            "build/classes",
            "org/example/ExamplePlugin.class",
            "-C",
            "src/main/resources",
            "plugin.yml",
          ],
          purpose: "package" as const,
        },
      ],
      workDirectoryPolicy: "isolated-clean" as const,
      rawOverridePolicy: "never-execute" as const,
      limits: {
        timeoutMs: 30_000,
        maxOutputBytes: 64 * 1024,
        maxDiskBytes: 128 * 1024 * 1024,
        retries: 0,
        artifactRetentionDays: 1,
      },
    };
    const result = await executeTuple({
      tuple: {
        id: sha256(canonicalJson(builtIdentity)),
        status: "discovered",
        blockers: [],
        identity: builtIdentity,
      },
      fixture: {
        tuple: builtIdentity,
        fixture: {
          id: builtIdentity.fixtureId,
          kind: "minimal-java",
          language: "java",
          version: "1.0.0",
          rawOverride: false,
        },
        descriptorPath: "templates/bukkit/descriptor.json",
        spec,
      },
      build,
      artifact: { path: "build/libs/example.jar", expectation },
      generatorDigest: sha256("generator"),
      parentDirectory: "/tmp",
      reviewedProfile: {
        id: builtIdentity.profileId,
        digest: builtIdentity.contentDigests.profile,
        artifactDigest: sha256(canonicalJson(expectation)),
      },
      wrapperPath: "gradlew",
      wrapperContent: new TextEncoder().encode("test-wrapper"),
      execute: nodeCommandExecutor,
      verifyJava: () => Promise.resolve(),
      generatedAt: "2026-08-10T00:00:00.000Z",
    });
    expect(result.evidence.status, JSON.stringify(result.evidence)).toBe(
      "verified",
    );
    expect(result.evidence.reproducibility?.reproducible).toBe(true);
    expect(result.firstArtifact?.status).toBe("passed");
    expect(result.firstBuild?.status).toBe("passed");
  });
});
