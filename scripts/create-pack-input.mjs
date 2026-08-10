import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repositoryRoot = process.cwd();

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function allowedPath(path) {
  if (path === "README.md") return true;
  if (
    [
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
    ].some((prefix) => path.startsWith(prefix))
  ) {
    return true;
  }
  return [
    "verification/phase5/audit.json",
    "verification/phase5/coverage.json",
    "verification/phase5/matrix.json",
  ].includes(path);
}

function latestCatalog(files) {
  const snapshots = files
    .map((path) => path.match(/^catalog\/([^/]+)\/index\.json$/u)?.[1])
    .filter((value) => value !== undefined)
    .sort((left, right) => left.localeCompare(right));
  const snapshot = snapshots.at(-1);
  if (!snapshot) throw new Error("no immutable catalog index is tracked");
  return snapshot;
}

async function revisions(files, prefix) {
  const result = [];
  for (const path of files.filter(
    (candidate) => candidate.startsWith(prefix) && candidate.endsWith(".json"),
  )) {
    const value = JSON.parse(
      await readFile(resolve(repositoryRoot, path), "utf8"),
    );
    if (
      typeof value.id === "string" &&
      Number.isInteger(value.revision) &&
      value.revision > 0
    ) {
      result.push({ id: value.id, revision: value.revision });
    }
  }
  return result.sort((left, right) => left.id.localeCompare(right.id));
}

const packVersion = argument("--pack-version", "1.0.0-beta.1");
const output = argument("--output", "verification/phase6/release-input.json");
if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u.test(packVersion)) {
  throw new Error(`invalid pack version ${packVersion}`);
}

const files = trackedFiles();
const catalogSnapshot = latestCatalog(files);
const packFiles = files.filter((path) => {
  if (path.startsWith("catalog/")) {
    return path.startsWith(`catalog/${catalogSnapshot}/`);
  }
  return allowedPath(path);
});
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const commitDate = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8",
}).trim();
const input = {
  $schema: "urn:mcgen:schema:pack-build-input:1",
  schemaVersion: 1,
  packVersion,
  sourceCommit,
  createdAt: new Date(commitDate).toISOString(),
  catalogSnapshot,
  familyRevisions: await revisions(packFiles, "templates/"),
  profileRevisions: await revisions(packFiles, "profiles/"),
  files: packFiles.map((path) => ({ path })),
};
const outputPath = resolve(repositoryRoot, output);
await writeFile(outputPath, `${JSON.stringify(input, null, 2)}\n`, {
  encoding: "utf8",
});
process.stdout.write(
  `wrote ${packFiles.length} pack inputs for ${sourceCommit} and ${catalogSnapshot}\n`,
);
