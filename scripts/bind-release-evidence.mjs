import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const directoryIndex = process.argv.indexOf("--dir");
const coverageIndex = process.argv.indexOf("--coverage");
if (directoryIndex < 0 || coverageIndex < 0) {
  throw new Error("release evidence binding requires --dir and --coverage");
}
const directory = resolve(process.cwd(), process.argv[directoryIndex + 1]);
const coveragePath = resolve(process.cwd(), process.argv[coverageIndex + 1]);
const manifest = JSON.parse(
  await readFile(join(directory, "pack-manifest.json"), "utf8"),
);
const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}
const canonical = (value) => `${JSON.stringify(normalize(value), null, 2)}\n`;
const coverageDigest = (await import("node:crypto"))
  .createHash("sha256")
  .update(canonical(coverage))
  .digest("hex");
const packCoverage = manifest.files.find(
  (file) => file.path === "verification/phase5/coverage.json",
);
if (!packCoverage)
  throw new Error("pack manifest does not contain phase 5 coverage");
const bound = {
  $schema: "urn:mcgen:verification:release-coverage:1",
  schemaVersion: 1,
  packVersion: manifest.packVersion,
  sourceCommit: manifest.sourceCommit,
  coverageDigest,
  packCoveragePath: packCoverage.path,
  packCoverageSha256: packCoverage.sha256,
  coverage,
};
await writeFile(join(directory, "coverage.json"), canonical(bound), "utf8");
