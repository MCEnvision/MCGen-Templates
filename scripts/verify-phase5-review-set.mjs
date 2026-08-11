import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const expectedPath = option("--expected");
const actualPath = option("--actual");
const matrixPath = option("--matrix");
const executionPath = option("--executions");
const coveragePath = option("--coverage");
if (
  !expectedPath ||
  !actualPath ||
  !matrixPath ||
  !executionPath ||
  !coveragePath
)
  throw new Error(
    "phase 5 review set requires expected, actual, matrix, executions, and coverage",
  );
const expectedRoot = resolve(process.cwd(), expectedPath);
const actualRoot = resolve(process.cwd(), actualPath);
const matrix = JSON.parse(
  await readFile(resolve(process.cwd(), matrixPath), "utf8"),
);
const coverage = JSON.parse(
  await readFile(resolve(process.cwd(), coveragePath), "utf8"),
);
const executionRoot = resolve(process.cwd(), executionPath);
const { canonicalJson } = await import("../dist/canonical-json.js");
const { buildCoverageSummary } = await import("../dist/coverage-summary.js");
const { validateEvidenceRecord } = await import("../dist/evidence.js");
const { validateMatrixPlan } = await import("../dist/matrix-planner.js");

const files = async (root) => (await readdir(root)).sort();
const jsonNames = (names) => names.filter((name) => name.endsWith(".json"));
const expectedFiles = await files(expectedRoot);
const actualFiles = await files(actualRoot);
const expectedNames = jsonNames(expectedFiles);
const actualNames = jsonNames(actualFiles);
if (
  expectedFiles.some((name) => !name.endsWith(".json")) ||
  actualFiles.some((name) => !name.endsWith(".json")) ||
  JSON.stringify(expectedNames) !== JSON.stringify(actualNames)
)
  throw new Error(
    "fresh phase 5 evidence does not cover the committed tuple set",
  );

const matrixFailures = validateMatrixPlan(matrix);
if (matrixFailures.length)
  throw new Error(`phase 5 matrix is invalid ${matrixFailures.join("; ")}`);
const matrixById = new Map(matrix.tuples.map((tuple) => [tuple.id, tuple]));
const matrixSnapshots = new Set(
  matrix.tuples.map((tuple) => tuple.identity.catalogSnapshotId),
);
if (
  matrixSnapshots.size !== 1 ||
  !matrixSnapshots.has(coverage.catalogSnapshotId)
)
  throw new Error(
    "phase 5 coverage catalog snapshot does not match the matrix",
  );
const executionNames = jsonNames(await files(executionRoot));
const executionIds = [];
for (const name of executionNames) {
  const execution = JSON.parse(
    await readFile(join(executionRoot, name), "utf8"),
  );
  executionIds.push(execution.tuple?.id);
  const tuple = matrixById.get(execution.tuple?.id);
  if (
    !tuple ||
    canonicalJson(execution.tuple.identity) !== canonicalJson(tuple.identity)
  )
    throw new Error(`${name} execution tuple is not in the matrix`);
}
if (
  executionIds.some((id) => typeof id !== "string") ||
  canonicalJson([...executionIds].sort()) !==
    canonicalJson([...matrixById.keys()].sort())
)
  throw new Error("phase 5 executions do not cover the matrix tuple set");

const expectedEvidence = [];
for (const name of expectedNames) {
  const expected = JSON.parse(await readFile(join(expectedRoot, name), "utf8"));
  const actual = JSON.parse(await readFile(join(actualRoot, name), "utf8"));
  const tuple = matrixById.get(expected.key?.digest);
  if (!tuple) throw new Error(`${name} evidence is not in the matrix`);
  const expectedFailures = validateEvidenceRecord(expected, {
    requireBuildAndArtifact: true,
  });
  if (expectedFailures.length)
    throw new Error(
      `${name} committed evidence is invalid ${expectedFailures.join("; ")}`,
    );
  const actualFailures = validateEvidenceRecord(actual, {
    requireBuildAndArtifact: true,
  });
  if (actualFailures.length)
    throw new Error(
      `${name} fresh evidence is invalid ${actualFailures.join("; ")}`,
    );
  if (
    actual.status !== "verified" ||
    actual.key?.digest !== expected.key?.digest ||
    canonicalJson(actual.key?.identity) !==
      canonicalJson(expected.key?.identity) ||
    actual.generatorDigest !== expected.generatorDigest
  )
    throw new Error(
      `${name} tuple identity differs from committed evidence\n` +
        `expected status: ${expected.status}\n` +
        `actual status: ${actual.status ?? "missing"}\n` +
        `actual build: ${canonicalJson(actual.build ?? null)}\n` +
        `actual artifact: ${canonicalJson(actual.artifact ?? null)}\n` +
        `actual reproducibility: ${canonicalJson(actual.reproducibility ?? null)}\n` +
        `actual blockers: ${canonicalJson(actual.blockers ?? [])}\n` +
        `expected identity: ${canonicalJson(expected.key?.identity)}\n` +
        `actual identity: ${canonicalJson(actual.key?.identity)}\n` +
        `expected digest: ${expected.key?.digest ?? "missing"}\n` +
        `actual digest: ${actual.key?.digest ?? "missing"}\n` +
        `expected generator: ${expected.generatorDigest}\n` +
        `actual generator: ${actual.generatorDigest ?? "missing"}`,
    );
  expectedEvidence.push(expected);
}

const generatorDigest = expectedEvidence[0]?.generatorDigest;
const rebuiltCoverage = buildCoverageSummary({
  catalogSnapshotId: coverage.catalogSnapshotId,
  generatedAt: coverage.generatedAt,
  matrixDigest: matrix.digest,
  tuples: matrix.tuples,
  evidence: expectedEvidence,
  generatorDigest,
});
if (canonicalJson(rebuiltCoverage) !== canonicalJson(coverage))
  throw new Error(
    "committed phase 5 coverage does not match matrix and evidence",
  );
if (
  coverage.matrixDigest !== matrix.digest ||
  coverage.total !== matrix.tuples.length
)
  throw new Error("phase 5 coverage matrix binding is invalid");
