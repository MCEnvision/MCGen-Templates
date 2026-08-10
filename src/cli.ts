#!/usr/bin/env node
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import { buildCatalog } from "./catalog/build.js";
import { buildCatalogDriftReport } from "./catalog/drift.js";
import { requireCatalogKeyKind } from "./catalog/platforms.js";
import type {
  CatalogCategory,
  CatalogKeyKind,
  SnapshotInput,
} from "./catalog/contracts.js";
import type { SourceSnapshot } from "./contracts.js";
import type { TupleEvidenceRecord } from "./phase5-contracts.js";
import { fetchDerivedResource, fetchResource } from "./fetch-resource.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "./schema-registry.js";
import { loadSourceDefinition } from "./source-definition.js";
import {
  buildFixtureManifest,
  type FixtureManifestInput,
} from "./fixture-generator.js";
import {
  buildMatrixPlan,
  validateMatrixPlan,
  type MatrixPlan,
  type MatrixPlanInput,
} from "./matrix-planner.js";
import { validateEvidenceRecord } from "./evidence.js";
import { buildQueuePlan, type QueueEvent } from "./phase5-queue.js";
import { buildCoverageSummary } from "./coverage-summary.js";
import { buildPhase5Audit } from "./phase5-audit.js";
import { readZipEntries } from "./artifact-inspector.js";
import {
  buildPack,
  buildSourceCommitManifest,
  buildSpdxSbom,
  type PackBuildInput,
  type PackFile,
} from "./pack-builder.js";
import {
  executeTuple,
  type Phase5ExecutionRequest,
} from "./phase5-execution.js";
import {
  requireSourceAdapter,
  requireSourceAdapterByAdapterId,
} from "./source-adapters.js";
import {
  canonicalJsonFiles,
  documentFailures,
  validateFiles,
} from "./validate.js";

const execFileAsync = promisify(execFile);

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function options(args: readonly string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${name} requires a repository path`);
      }
      values.push(value);
      index += 1;
    }
  }
  return values;
}

const sourceFetchConcurrency = 8;

async function fetchAll<T, Result>(
  values: readonly T[],
  operation: (value: T) => Promise<Result>,
): Promise<Result[]> {
  const results = new Array<Result>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value === undefined) return;
      results[index] = await operation(value);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(sourceFetchConcurrency, values.length) },
      () => worker(),
    ),
  );
  return results;
}

function requireRepositoryPath(path: string): string {
  const absolute = resolve(repositoryRoot, path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (repositoryRelative.startsWith("..") || repositoryRelative === "") {
    throw new Error("output path must be a file inside the repository");
  }
  return absolute;
}

function requireSnapshotPath(snapshotDirectory: string, path: string): string {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith(`sources/snapshots/${snapshotDirectory}/`) ||
    !repositoryRelative.endsWith(".json")
  ) {
    throw new Error(
      `snapshots must use a json file under sources/snapshots/${snapshotDirectory}`,
    );
  }
  return absolute;
}

async function requireUnusedPath(path: string): Promise<void> {
  try {
    await stat(path);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`snapshot output already exists at ${path}`);
}

function requireCatalogDirectory(path: string): {
  absolute: string;
  relative: string;
} {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith("catalog/") ||
    repositoryRelative === "catalog" ||
    repositoryRelative.endsWith(".json")
  ) {
    throw new Error("catalog output must be a new directory under catalog");
  }
  return { absolute, relative: repositoryRelative };
}

function requireSourceSnapshotPath(path: string): string {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith("sources/snapshots/") ||
    !repositoryRelative.endsWith(".json")
  ) {
    throw new Error(
      "catalog snapshots must be immutable json files under sources/snapshots",
    );
  }
  return absolute;
}

function requireCatalogDocumentPath(path: string): string {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith("catalog/") ||
    !repositoryRelative.endsWith(".json")
  ) {
    throw new Error("catalog report output must be a json file under catalog");
  }
  return absolute;
}

function requirePhase5DocumentPath(path: string): string {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith("verification/phase5/") ||
    !repositoryRelative.endsWith(".json")
  )
    throw new Error(
      "phase 5 output must be a json file under verification/phase5",
    );
  return absolute;
}

function requirePhase6OutputDirectory(path: string): {
  absolute: string;
  relative: string;
} {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith("verification/phase6/") ||
    repositoryRelative.endsWith("/")
  ) {
    throw new Error(
      "phase 6 output must be a directory under verification/phase6",
    );
  }
  return { absolute, relative: repositoryRelative };
}

async function requireSafePhase6OutputParent(path: string): Promise<void> {
  const parent = dirname(path);
  const repositoryRelative = relative(repositoryRoot, parent);
  if (repositoryRelative.startsWith("..")) {
    throw new Error("phase 6 output parent must remain inside the repository");
  }
  let current = repositoryRoot;
  for (const part of repositoryRelative.split("/")) {
    if (!part) continue;
    current = resolve(current, part);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw new Error(
          `phase 6 output parent cannot contain symlinks: ${part}`,
        );
      }
      if (!metadata.isDirectory()) {
        throw new Error(`phase 6 output parent is not a directory: ${part}`);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        return;
      }
      throw error;
    }
  }
}

function phase6InputPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const allowed =
    normalized === "README.md" ||
    [
      "catalog/",
      "docs/architecture/",
      "docs/data/",
      "docs/release/",
      "docs/verification/",
      "fixtures/",
      "profiles/",
      "schemas/",
      "sources/definitions/",
      "sources/snapshots/",
      "templates/",
      "verification/phase5/evidence/",
    ].some((prefix) => normalized.startsWith(prefix));
  const approvedPhase5Document = [
    "verification/phase5/audit.json",
    "verification/phase5/coverage.json",
    "verification/phase5/matrix.json",
  ].includes(normalized);
  const approved = allowed || approvedPhase5Document;
  if (!approved) {
    throw new Error(`phase 6 path is outside the pack allowlist: ${path}`);
  }
  const protectedComponents = new Set([
    ".git",
    ".gradle",
    "build",
    "dist",
    "logs",
    "node_modules",
    "tmp",
    "cache",
  ]);
  const components = normalized.split("/");
  if (
    normalized.startsWith("verification/phase6/") ||
    normalized.includes("/.git/") ||
    normalized.includes("/node_modules/") ||
    normalized.includes("/.gradle/") ||
    normalized.startsWith(".git/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith(".gradle/") ||
    normalized.startsWith("dist/") ||
    normalized.startsWith("logs/") ||
    /(?:^|\/)(?:\.env|.*\.pem|.*\.key)$/u.test(normalized) ||
    components.some((component) =>
      protectedComponents.has(component.toLocaleLowerCase("en-US")),
    )
  ) {
    throw new Error(`phase 6 path is outside the pack allowlist: ${path}`);
  }
  return normalized;
}

async function readPackInputFile(path: string): Promise<Uint8Array> {
  try {
    await execFileAsync("git", ["ls-files", "--error-unmatch", "--", path], {
      cwd: repositoryRoot,
    });
  } catch {
    throw new Error(`phase 6 pack input must be a tracked file: ${path}`);
  }
  const parts = path.split("/");
  let current = repositoryRoot;
  for (const [index, part] of parts.entries()) {
    current = resolve(current, part);
    const metadata = await lstat(current);
    if (metadata.isSymbolicLink()) {
      throw new Error(`phase 6 pack input cannot contain symlinks: ${path}`);
    }
    if (index < parts.length - 1 && !metadata.isDirectory()) {
      throw new Error(`phase 6 pack input path is not a directory: ${path}`);
    }
    if (index === parts.length - 1 && !metadata.isFile()) {
      throw new Error(`phase 6 pack input is not a regular file: ${path}`);
    }
    if (index === parts.length - 1 && metadata.size > 32 * 1024 * 1024) {
      throw new Error(`phase 6 pack input file is too large: ${path}`);
    }
  }
  const content = await readFile(current);
  const text = content.toString("utf8");
  if (
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/iu.test(text) ||
    /(?:github_pat_|ghp_|gho_|ghs_|ghu_|ghr_|npm_)[A-Za-z0-9_]{20,}/u.test(
      text,
    ) ||
    /(?:aws_access_key_id|aws_secret_access_key)\s*=\s*[^\s]+/iu.test(text) ||
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u.test(text)
  ) {
    throw new Error(
      `phase 6 pack input appears to contain a credential: ${path}`,
    );
  }
  return content;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(
    await readFile(requireRepositoryPath(path), "utf8"),
  ) as unknown;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function javaEnvironment(runtime: number): NodeJS.ProcessEnv | undefined {
  const home =
    process.env[`JAVA_HOME_${runtime}_X64`] ?? process.env["JAVA_HOME"];
  if (!home) return undefined;
  return {
    JAVA_HOME: home,
    PATH: `${resolve(home, "bin")}${delimiter}${process.env["PATH"] ?? ""}`,
  };
}

async function writePhase5Document(
  path: string,
  document: unknown,
): Promise<void> {
  const outputPath = requirePhase5DocumentPath(path);
  await requireUnusedPath(outputPath);
  const failures = documentFailures(
    await createSchemaRegistry(),
    outputPath,
    document,
  );
  if (failures.length)
    throw new Error(
      `phase 5 document validation failed\n${failures.join("\n")}`,
    );
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalJson(document), {
    encoding: "utf8",
    flag: "wx",
  });
}

async function phase5FixtureManifest(args: readonly string[]): Promise<void> {
  const input = option(args, "--input");
  const output = option(args, "--output");
  if (!input || !output)
    throw new Error("phase5 fixture-manifest requires --input and --output");
  const manifest = buildFixtureManifest(
    (await readJson(input)) as FixtureManifestInput,
  );
  await writePhase5Document(output, manifest);
  process.stdout.write(
    `generated ${manifest.fixtures.length} phase 5 fixtures\n`,
  );
}

async function phase5MatrixPlan(args: readonly string[]): Promise<void> {
  const input = option(args, "--input");
  const output = option(args, "--output");
  if (!input || !output)
    throw new Error("phase5 matrix-plan requires --input and --output");
  const plan = buildMatrixPlan((await readJson(input)) as MatrixPlanInput);
  const failures = validateMatrixPlan(plan);
  if (failures.length)
    throw new Error(`matrix plan is invalid\n${failures.join("\n")}`);
  await writePhase5Document(output, plan);
  process.stdout.write(
    `planned ${plan.tuples.length} phase 5 tuples in ${plan.shardCount} shards\n`,
  );
}

async function phase5ValidateEvidence(args: readonly string[]): Promise<void> {
  const input = option(args, "--input");
  if (!input) throw new Error("phase5 validate-evidence requires --input");
  const document = (await readJson(input)) as Parameters<
    typeof validateEvidenceRecord
  >[0];
  const failures = validateEvidenceRecord(document, {
    requireBuildAndArtifact:
      document.status === "verified" || document.status === "legacy-verified",
  });
  if (failures.length)
    throw new Error(`evidence is invalid\n${failures.join("\n")}`);
  process.stdout.write("validated phase 5 evidence\n");
}

async function phase5Coverage(args: readonly string[]): Promise<void> {
  const input = option(args, "--input");
  const output = option(args, "--output");
  if (!input || !output)
    throw new Error("phase5 coverage requires --input and --output");
  const document = requireRecord(
    await readJson(input),
    "phase5 coverage input",
  );
  const matrix = requireRecord(
    document["matrix"],
    "phase5 matrix",
  ) as unknown as MatrixPlan;
  const matrixFailures = validateMatrixPlan(matrix);
  if (matrixFailures.length)
    throw new Error(`phase 5 matrix is invalid\n${matrixFailures.join("\n")}`);
  const evidenceValue = document["evidence"];
  if (!Array.isArray(evidenceValue))
    throw new Error("phase5 coverage evidence must be an array");
  const evidence = evidenceValue as TupleEvidenceRecord[];
  const catalogSnapshotId = document["catalogSnapshotId"];
  const generatedAt = document["generatedAt"];
  const generatorDigest = document["generatorDigest"];
  if (
    typeof catalogSnapshotId !== "string" ||
    typeof generatedAt !== "string" ||
    typeof generatorDigest !== "string"
  )
    throw new Error(
      "phase5 coverage input requires catalogSnapshotId, generatedAt, and generatorDigest",
    );
  if (
    matrix.tuples.some(
      (tuple) => tuple.identity.catalogSnapshotId !== catalogSnapshotId,
    )
  )
    throw new Error("phase5 coverage catalog snapshot does not match matrix");
  const summary = buildCoverageSummary({
    catalogSnapshotId,
    generatedAt,
    matrixDigest: matrix.digest,
    tuples: matrix.tuples,
    evidence,
    generatorDigest,
  });
  await writePhase5Document(output, summary);
  process.stdout.write(`wrote phase 5 coverage summary ${summary.digest}\n`);
}

async function phase5Audit(args: readonly string[]): Promise<void> {
  const output = option(args, "--output");
  if (!output) throw new Error("phase5 audit requires --output");
  const generatedAt = option(args, "--generated-at");
  if (!generatedAt) throw new Error("phase5 audit requires --generated-at");
  const audit = await buildPhase5Audit({ generatedAt });
  await writePhase5Document(output, audit);
  process.stdout.write(`wrote phase 5 audit ${audit.digest}\n`);
}

async function phase5Queue(args: readonly string[]): Promise<void> {
  const input = option(args, "--input");
  const output = option(args, "--output");
  const shardCount = Number(option(args, "--shard-count"));
  const shardIndex = Number(option(args, "--shard-index"));
  if (!output) throw new Error("phase5 queue requires --output");
  const event = input
    ? ((await readJson(input)) as QueueEvent)
    : {
        queue: option(args, "--queue"),
        subject: option(args, "--subject"),
        changedPaths: options(args, "--changed-path"),
        tupleIds: options(args, "--tuple-id"),
        createdAt: option(args, "--created-at") ?? new Date().toISOString(),
      };
  if (
    typeof event.queue !== "string" ||
    typeof event.subject !== "string" ||
    typeof event.createdAt !== "string" ||
    !Array.isArray(event.changedPaths) ||
    !Array.isArray(event.tupleIds)
  )
    throw new Error("phase5 queue event is incomplete");
  const plan = buildQueuePlan({
    event: event as QueueEvent,
    shardCount,
    shardIndex,
  });
  await writePhase5Document(output, plan);
  process.stdout.write(
    `planned ${plan.tupleIds.length} phase 5 queue tuples\n`,
  );
}

async function phase5Execute(args: readonly string[]): Promise<void> {
  const input = option(args, "--input");
  const output = option(args, "--output");
  if (!input || !output)
    throw new Error("phase5 execute requires --input and --output");
  const document = requireRecord(await readJson(input), "phase5 execute input");
  const validation = validateWithSchema(await createSchemaRegistry(), document);
  if (!validation.valid)
    throw new Error(
      `phase5 execution input is invalid\n${validation.errors
        .map((error) => `${error.instancePath} ${error.message ?? "invalid"}`)
        .join("\n")}`,
    );
  const {
    tuple,
    fixture,
    build,
    artifact,
    generatorDigest,
    generatedAt,
    wrapperSource,
    wrapperPath,
    profilePath,
  } = document;
  if (
    tuple === undefined ||
    fixture === undefined ||
    build === undefined ||
    artifact === undefined ||
    typeof generatorDigest !== "string" ||
    typeof generatedAt !== "string"
  )
    throw new Error(
      "phase5 execute input requires tuple, fixture, build, artifact, generatorDigest, and generatedAt",
    );
  if (typeof profilePath !== "string")
    throw new Error("phase5 execute requires a reviewed profilePath");
  const profileAbsolute = requireRepositoryPath(profilePath);
  const profileRelative = relative(repositoryRoot, profileAbsolute);
  if (
    !profileRelative.startsWith("profiles/") ||
    !profileRelative.endsWith(".json")
  )
    throw new Error("phase5 profilePath must point to a profile document");
  const profile = requireRecord(
    JSON.parse(await readFile(profileAbsolute, "utf8")) as unknown,
    "phase5 profile",
  );
  if (profile["status"] !== "reviewed")
    throw new Error("phase5 execution requires a reviewed profile");
  const profileDigest = sha256(canonicalJson(profile));
  const tupleRecord = requireRecord(tuple, "phase5 tuple");
  const identity = requireRecord(
    tupleRecord["identity"],
    "phase5 tuple identity",
  );
  if (identity["profileId"] !== profile["id"])
    throw new Error("phase5 profile does not match tuple identity");
  const identityDigests = requireRecord(
    identity["contentDigests"],
    "phase5 tuple content digests",
  );
  if (identityDigests["profile"] !== profileDigest)
    throw new Error("phase5 profile digest does not match tuple identity");
  const profileBuild = requireRecord(profile["build"], "phase5 profile build");
  const profileJava = requireRecord(profile["java"], "phase5 profile java");
  const profileArtifact = requireRecord(
    profile["artifact"],
    "phase5 profile artifact",
  );
  const artifactRecord = requireRecord(artifact, "phase5 artifact");
  const artifactExpectation = requireRecord(
    artifactRecord["expectation"],
    "phase5 artifact expectation",
  );
  if (canonicalJson(artifactExpectation) !== canonicalJson(profileArtifact))
    throw new Error(
      "phase5 artifact expectation does not match reviewed profile",
    );
  const buildRecord = requireRecord(build, "phase5 build");
  const buildJava = requireRecord(buildRecord["java"], "phase5 build java");
  if (
    buildJava["runtime"] !== profileJava["runtime"] ||
    buildJava["distribution"] !== profileJava["distribution"] ||
    requireRecord(buildRecord["wrapper"], "phase5 build wrapper")["sha256"] !==
      profileBuild["wrapperSha256"] ||
    (profileBuild["wrapperDistributionSha256"] !== undefined &&
      requireRecord(buildRecord["wrapper"], "phase5 build wrapper")[
        "distributionSha256"
      ] !== profileBuild["wrapperDistributionSha256"])
  )
    throw new Error("phase5 build toolchain does not match reviewed profile");
  const verification = requireRecord(
    profile["verification"],
    "phase5 profile verification",
  );
  const profileCommands = verification["commands"];
  const buildCommands = buildRecord["commands"];
  if (!Array.isArray(profileCommands) || !Array.isArray(buildCommands))
    throw new Error("phase5 profile and build commands are required");
  const commandShape = buildCommands.map((command) => {
    const item = requireRecord(command, "phase5 build command");
    const executable = item["executable"];
    const args = item["args"];
    if (
      typeof executable !== "string" ||
      !Array.isArray(args) ||
      args.some((argument) => typeof argument !== "string")
    )
      throw new Error("phase5 build command is invalid");
    return [executable, ...args.map((argument) => String(argument))];
  });
  if (canonicalJson(commandShape) !== canonicalJson(profileCommands))
    throw new Error("phase5 build commands do not match reviewed profile");
  const request = {
    tuple: tupleRecord,
    fixture: {
      ...requireRecord(fixture, "phase5 fixture"),
      repositoryRoot: repositoryRoot,
    },
    build: requireRecord(build, "phase5 build"),
    artifact: artifactRecord,
    generatorDigest,
    parentDirectory: tmpdir(),
    reviewedProfile: {
      id: String(profile["id"]),
      digest: profileDigest,
      artifactDigest: sha256(canonicalJson(profileArtifact)),
    },
    generatedAt,
    environment: javaEnvironment(Number(profileJava["runtime"])),
    ...(typeof wrapperSource === "string"
      ? {
          wrapperPath:
            typeof wrapperPath === "string" ? wrapperPath : "gradlew",
          wrapperContent: await readFile(requireRepositoryPath(wrapperSource)),
        }
      : {}),
  } as unknown as Phase5ExecutionRequest;
  const result = await executeTuple(request);
  await writePhase5Document(output, result.evidence);
  process.stdout.write(
    `wrote phase 5 evidence ${result.evidence.key.digest}\n`,
  );
}

async function phase5ExecuteReviewed(args: readonly string[]): Promise<void> {
  const inputDirectory = option(args, "--input-dir");
  const outputDirectory = option(args, "--output-dir");
  if (!inputDirectory || !outputDirectory)
    throw new Error(
      "phase5 execute-reviewed requires --input-dir and --output-dir",
    );
  const inputAbsolute = requireRepositoryPath(inputDirectory);
  const outputAbsolute = requireRepositoryPath(outputDirectory);
  const inputRelative = relative(repositoryRoot, inputAbsolute);
  const outputRelative = relative(repositoryRoot, outputAbsolute);
  if (
    inputRelative !== "verification/phase5/executions" ||
    outputRelative !== "verification/phase5/evidence"
  )
    throw new Error(
      "phase5 execute-reviewed directories must be under verification/phase5",
    );
  const inputs = (await readdir(inputAbsolute))
    .filter((name) => name.endsWith(".json"))
    .sort();
  await mkdir(outputAbsolute, { recursive: true });
  for (const name of inputs) {
    await phase5Execute([
      "--input",
      `${inputRelative}/${name}`,
      "--output",
      `${outputRelative}/${name}`,
    ]);
  }
  process.stdout.write(`executed ${inputs.length} reviewed phase 5 tuples\n`);
}

async function validate(args: readonly string[]): Promise<void> {
  const files = args.length
    ? args.map((path) => requireRepositoryPath(path))
    : await canonicalJsonFiles();
  if (files.length === 0) {
    throw new Error("no canonical json documents were found");
  }
  const failures = await validateFiles(files);
  if (failures.length) {
    throw new Error(`schema validation failed\n${failures.join("\n")}`);
  }
  process.stdout.write(`validated ${files.length} canonical documents\n`);
}

async function snapshotSource(
  sourceId: string,
  args: readonly string[],
): Promise<void> {
  const output = option(args, "--output");
  if (!output) {
    throw new Error("snapshot requires --output <repository path>");
  }
  const adapter = requireSourceAdapter(sourceId);
  const outputPath = requireSnapshotPath(adapter.snapshotDirectory, output);
  await requireUnusedPath(outputPath);
  const definition = await loadSourceDefinition(adapter.id);
  const fetched = await fetchAll(definition.sources, (source) =>
    fetchResource(source, definition.requestPolicy),
  );
  const resources = new Map<string, (typeof fetched)[number]>();
  for (const [index, resource] of fetched.entries()) {
    const source = definition.sources[index];
    if (!source) {
      throw new Error("fetched source has no definition resource");
    }
    resources.set(source.id, resource);
  }
  const derivedSources = adapter.derive?.(resources) ?? [];
  for (const source of derivedSources) {
    if (resources.has(source.key)) {
      throw new Error(`derived source key is duplicated ${source.key}`);
    }
  }
  const derivedFetched = await fetchAll(derivedSources, (source) =>
    fetchDerivedResource(source, definition.requestPolicy),
  );
  for (const [index, source] of derivedSources.entries()) {
    const resource = derivedFetched[index];
    if (!resource) {
      throw new Error(`derived source was not fetched ${source.key}`);
    }
    resources.set(source.key, resource);
  }
  const snapshot = adapter.build(resources, new Date().toISOString());
  const failures = documentFailures(
    await createSchemaRegistry(),
    outputPath,
    snapshot,
  );
  if (failures.length) {
    throw new Error(`snapshot validation failed\n${failures.join("\n")}`);
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalJson(snapshot), {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(
    `captured ${snapshot.entries.length} ${adapter.id} entries with ${snapshot.rejected.length} rejected entries\n`,
  );
}

async function catalogSourceSnapshots(
  args: readonly string[],
): Promise<SnapshotInput[]> {
  const requested = options(args, "--snapshot");
  const paths = requested.length
    ? requested.map(requireSourceSnapshotPath)
    : (await canonicalJsonFiles()).filter((path) =>
        relative(repositoryRoot, path).startsWith("sources/snapshots/"),
      );
  if (paths.length === 0) {
    throw new Error(
      "catalog generation requires at least one immutable source snapshot",
    );
  }
  const registry = await createSchemaRegistry();
  const snapshots: SnapshotInput[] = [];
  for (const path of paths.sort((left, right) => left.localeCompare(right))) {
    const document = JSON.parse(await readFile(path, "utf8")) as unknown;
    const failures = documentFailures(registry, path, document);
    if (failures.length) {
      throw new Error(
        `source snapshot validation failed\n${failures.join("\n")}`,
      );
    }
    if (
      document === null ||
      typeof document !== "object" ||
      (document as { $schema?: unknown }).$schema !==
        "urn:mcgen:schema:source-snapshot:1"
    ) {
      throw new Error(
        `catalog input ${relative(repositoryRoot, path)} is not a source snapshot`,
      );
    }
    snapshots.push({
      path: relative(repositoryRoot, path),
      snapshot: document as SourceSnapshot,
    });
  }
  return snapshots;
}

async function catalogSourceSnapshot(path: string): Promise<SnapshotInput> {
  const absolute = requireSourceSnapshotPath(path);
  const registry = await createSchemaRegistry();
  const document = JSON.parse(await readFile(absolute, "utf8")) as unknown;
  const failures = documentFailures(registry, absolute, document);
  if (failures.length) {
    throw new Error(
      `source snapshot validation failed\n${failures.join("\n")}`,
    );
  }
  if (
    document === null ||
    typeof document !== "object" ||
    (document as { $schema?: unknown }).$schema !==
      "urn:mcgen:schema:source-snapshot:1"
  ) {
    throw new Error(
      `catalog input ${relative(repositoryRoot, absolute)} is not a source snapshot`,
    );
  }
  return {
    path: relative(repositoryRoot, absolute),
    snapshot: document as SourceSnapshot,
  };
}

async function generateCatalogDrift(args: readonly string[]): Promise<void> {
  const baselinePath = option(args, "--baseline");
  const candidatePath = option(args, "--candidate");
  const output = option(args, "--output");
  if (!baselinePath || !candidatePath || !output) {
    throw new Error(
      "catalog drift requires --baseline <snapshot> --candidate <snapshot> --output <report>",
    );
  }
  const outputPath = requireCatalogDocumentPath(output);
  await requireUnusedPath(outputPath);
  const [baseline, candidate] = await Promise.all([
    catalogSourceSnapshot(baselinePath),
    catalogSourceSnapshot(candidatePath),
  ]);
  if (baseline.snapshot.adapter.id !== candidate.snapshot.adapter.id) {
    throw new Error("catalog drift snapshots must use the same adapter");
  }
  const report = buildCatalogDriftReport([baseline], [candidate]);
  const failures = documentFailures(
    await createSchemaRegistry(),
    outputPath,
    report,
  );
  if (failures.length) {
    throw new Error(`catalog drift validation failed\n${failures.join("\n")}`);
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, canonicalJson(report), {
    encoding: "utf8",
    flag: "wx",
  });
  process.stdout.write(
    `generated catalog drift with ${report.added.length} additions and ${report.removed.length} removals\n`,
  );
}

async function generateCatalog(args: readonly string[]): Promise<void> {
  const output = option(args, "--output");
  if (!output) {
    throw new Error(
      "catalog generate requires --output <repository directory>",
    );
  }
  const destination = requireCatalogDirectory(output);
  await requireUnusedPath(destination.absolute);
  const snapshots = await catalogSourceSnapshots(args);
  const categoryByPlatform: Record<string, CatalogCategory> = {};
  const keyKindByPlatform: Record<string, CatalogKeyKind> = {};
  for (const snapshot of snapshots) {
    const adapter = requireSourceAdapterByAdapterId(
      snapshot.snapshot.adapter.id,
    );
    const definition = await loadSourceDefinition(adapter.id);
    for (const entry of snapshot.snapshot.entries) {
      categoryByPlatform[entry.platform] = definition.category;
      keyKindByPlatform[entry.platform] = requireCatalogKeyKind(
        definition.platform,
      );
    }
  }
  const catalog = buildCatalog({
    snapshots,
    categoryByPlatform,
    keyKindByPlatform,
    outputRoot: destination.relative,
  });
  const documents: { path: string; document: unknown }[] = [
    { path: `${destination.relative}/index.json`, document: catalog.index },
    {
      path: `${destination.relative}/recommendation-policy.json`,
      document: catalog.policy,
    },
    {
      path: `${destination.relative}/coverage.json`,
      document: catalog.coverage,
    },
    ...catalog.platformIndexes.map((document) => ({
      path: `${destination.relative}/platforms/${document.platform}/index.json`,
      document,
    })),
    ...catalog.shards,
  ];
  const registry = await createSchemaRegistry();
  const failures = documents.flatMap(({ path, document }) =>
    documentFailures(registry, resolve(repositoryRoot, path), document),
  );
  if (failures.length) {
    throw new Error(`catalog validation failed\n${failures.join("\n")}`);
  }
  for (const { path } of documents) {
    if (!path.startsWith(`${destination.relative}/`)) {
      throw new Error(
        "catalog generator emitted a document outside its output directory",
      );
    }
  }
  await mkdir(destination.absolute, { recursive: true });
  for (const { path, document } of documents) {
    const absolute = requireRepositoryPath(path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, canonicalJson(document), {
      encoding: "utf8",
      flag: "wx",
    });
  }
  const generatedPaths = documents.map(({ path }) =>
    requireRepositoryPath(path),
  );
  const postWriteFailures = await validateFiles([
    ...snapshots.map(({ path }) => requireRepositoryPath(path)),
    ...generatedPaths,
  ]);
  if (postWriteFailures.length) {
    throw new Error(
      `catalog integrity validation failed\n${postWriteFailures.join("\n")}`,
    );
  }
  process.stdout.write(
    `generated ${catalog.shards.length} immutable catalog shards from ${snapshots.length} source snapshots\n`,
  );
}

async function phase6Pack(args: readonly string[]): Promise<void> {
  const inputPath = option(args, "--input");
  const outputDirectory = option(args, "--output-dir");
  if (!inputPath || !outputDirectory) {
    throw new Error("phase6 pack requires --input and --output-dir");
  }
  const inputAbsolute = requireRepositoryPath(inputPath);
  const input = requireRecord(await readJson(inputPath), "phase 6 pack input");
  const { stdout: headOutput } = await execFileAsync(
    "git",
    ["rev-parse", "HEAD"],
    { cwd: repositoryRoot },
  );
  const checkedOutCommit = headOutput.trim();
  if (String(input["sourceCommit"]) !== checkedOutCommit) {
    throw new Error(
      `phase 6 pack source commit ${String(input["sourceCommit"])} does not match checked out commit ${checkedOutCommit}`,
    );
  }
  const registry = await createSchemaRegistry();
  const inputValidation = validateWithSchema(registry, input);
  if (!inputValidation.valid) {
    throw new Error(
      `phase 6 pack input is invalid\n${inputValidation.errors
        .map((error) => `${error.instancePath} ${error.message ?? "invalid"}`)
        .join("\n")}`,
    );
  }
  const output = requirePhase6OutputDirectory(outputDirectory);
  const inputFiles = input["files"];
  if (!Array.isArray(inputFiles)) {
    throw new Error("phase 6 pack input files are required");
  }
  const files: PackFile[] = [];
  for (const value of inputFiles) {
    const record = requireRecord(value, "phase 6 pack file");
    const path = phase6InputPath(String(record["path"]));
    files.push({ path, content: await readPackInputFile(path) });
  }
  const buildInput: PackBuildInput = {
    packVersion: String(input["packVersion"]),
    sourceCommit: String(input["sourceCommit"]),
    createdAt: String(input["createdAt"]),
    files,
    ...(typeof input["catalogSnapshot"] === "string"
      ? { catalogSnapshot: input["catalogSnapshot"] }
      : {}),
    ...(Array.isArray(input["familyRevisions"])
      ? {
          familyRevisions: input["familyRevisions"] as NonNullable<
            PackBuildInput["familyRevisions"]
          >,
        }
      : {}),
    ...(Array.isArray(input["profileRevisions"])
      ? {
          profileRevisions: input["profileRevisions"] as NonNullable<
            PackBuildInput["profileRevisions"]
          >,
        }
      : {}),
  };
  const first = buildPack(buildInput);
  const second = buildPack(buildInput);
  const archiveReproducible =
    Buffer.from(first.archive).equals(Buffer.from(second.archive)) &&
    first.archiveSha256 === second.archiveSha256 &&
    first.archiveSha512 === second.archiveSha512;
  if (!archiveReproducible) {
    throw new Error("phase 6 pack archive is not reproducible");
  }
  const archiveEntries = readZipEntries(first.archive);
  const expectedArchivePaths = [
    ...first.manifest.files.map((file) => file.path),
    "pack-manifest.json",
  ].sort(compareText);
  const actualArchivePaths = archiveEntries
    .map((entry) => entry.path)
    .sort(compareText);
  if (
    canonicalJson(actualArchivePaths) !== canonicalJson(expectedArchivePaths)
  ) {
    throw new Error("phase 6 archive readback does not match its manifest");
  }
  const manifestEntry = archiveEntries.find(
    (entry) => entry.path === "pack-manifest.json",
  );
  if (
    !manifestEntry ||
    new TextDecoder().decode(manifestEntry.content) !==
      canonicalJson(first.manifest)
  ) {
    throw new Error("phase 6 archive manifest readback is invalid");
  }
  const sbom = buildSpdxSbom(first.manifest);
  const sourceCommitManifest = buildSourceCommitManifest(first.manifest);
  const summary = {
    $schema: "urn:mcgen:schema:verification-summary:1",
    schemaVersion: 1,
    packVersion: first.manifest.packVersion,
    sourceCommit: first.manifest.sourceCommit,
    status: "verified" as const,
    archive: {
      path: `${output.relative}/mcgen-template-pack.zip`,
      sha256: first.archiveSha256,
      sha512: first.archiveSha512,
      bytes: first.archiveBytes,
    },
    ...(first.manifest.files.some(
      (file) => file.path === "verification/phase5/coverage.json",
    )
      ? { coverage: "verification/phase5/coverage.json" }
      : {}),
    checks: [
      {
        id: "pack-manifest",
        status: "passed" as const,
        detail: "all source paths are normalized and content addressed",
      },
      {
        id: "archive-reproducibility",
        status: "passed" as const,
        detail: "two in memory builds produced byte identical archives",
      },
      {
        id: "spdx-sbom",
        status: "passed" as const,
        detail: "the SPDX 2.3 file inventory matches the pack manifest",
      },
    ],
  };
  const documents: { path: string; value: unknown }[] = [
    { path: "pack-manifest.json", value: first.manifest },
    { path: "source-commit-manifest.json", value: sourceCommitManifest },
    { path: "spdx-sbom.json", value: sbom },
    { path: "verification-summary.json", value: summary },
  ];
  const documentFailuresList = documents.flatMap(({ path, value }) =>
    documentFailures(registry, resolve(output.absolute, path), value),
  );
  if (documentFailuresList.length) {
    throw new Error(
      `phase 6 generated document validation failed\n${documentFailuresList.join("\n")}`,
    );
  }
  await stat(inputAbsolute);
  await requireUnusedPath(output.absolute);
  await requireSafePhase6OutputParent(output.absolute);
  await mkdir(dirname(output.absolute), { recursive: true });
  const staging = await mkdtemp(
    resolve(dirname(output.absolute), ".mcgen-phase6-"),
  );
  try {
    for (const document of documents) {
      const path = resolve(staging, document.path);
      await writeFile(path, canonicalJson(document.value), {
        encoding: "utf8",
        flag: "wx",
      });
    }
    await writeFile(
      resolve(staging, "mcgen-template-pack.zip"),
      first.archive,
      {
        flag: "wx",
      },
    );
    await writeFile(
      resolve(staging, "mcgen-template-pack.zip.sha256"),
      `${first.archiveSha256}  mcgen-template-pack.zip\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await writeFile(
      resolve(staging, "mcgen-template-pack.zip.sha512"),
      `${first.archiveSha512}  mcgen-template-pack.zip\n`,
      { encoding: "utf8", flag: "wx" },
    );
    await rename(staging, output.absolute);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write(
    `built deterministic phase 6 pack ${first.archiveSha256}\n`,
  );
}

async function main(): Promise<void> {
  const [command, subject, ...args] = process.argv.slice(2);
  if (command === "validate") {
    await validate(subject ? [subject, ...args] : args);
    return;
  }
  if (command === "snapshot" && subject) {
    await snapshotSource(subject, args);
    return;
  }
  if (command === "catalog" && subject === "generate") {
    await generateCatalog(args);
    return;
  }
  if (command === "catalog" && subject === "drift") {
    await generateCatalogDrift(args);
    return;
  }
  if (command === "phase6" && subject === "pack") {
    await phase6Pack(args);
    return;
  }
  if (command === "phase5" && subject === "fixture-manifest") {
    await phase5FixtureManifest(args);
    return;
  }
  if (command === "phase5" && subject === "matrix-plan") {
    await phase5MatrixPlan(args);
    return;
  }
  if (command === "phase5" && subject === "validate-evidence") {
    await phase5ValidateEvidence(args);
    return;
  }
  if (command === "phase5" && subject === "coverage") {
    await phase5Coverage(args);
    return;
  }
  if (command === "phase5" && subject === "audit") {
    await phase5Audit(args);
    return;
  }
  if (command === "phase5" && subject === "queue") {
    await phase5Queue(args);
    return;
  }
  if (command === "phase5" && subject === "execute") {
    await phase5Execute(args);
    return;
  }
  if (command === "phase5" && subject === "execute-reviewed") {
    await phase5ExecuteReviewed(args);
    return;
  }
  throw new Error(
    "usage: mcgen-template-tool validate [paths...] or snapshot <adapter> --output <path>, or catalog generate --output <directory> [--snapshot <path>], or catalog drift --baseline <snapshot> --candidate <snapshot> --output <report>, or phase6 pack --input <path> --output-dir <directory>, or phase5 fixture-manifest --input <path> --output <path>, or phase5 matrix-plan --input <path> --output <path>, or phase5 validate-evidence --input <path>, or phase5 queue --input <path> --output <path> --shard-count <n> --shard-index <n>",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
