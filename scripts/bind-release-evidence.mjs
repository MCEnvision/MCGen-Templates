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
if (coverage.sourceCommit !== undefined || coverage.packVersion !== undefined) {
  throw new Error("coverage evidence is already release bound");
}
const bound = {
  ...coverage,
  packVersion: manifest.packVersion,
  sourceCommit: manifest.sourceCommit,
};
await writeFile(
  join(directory, "coverage.json"),
  `${JSON.stringify(bound, null, 2)}\n`,
  "utf8",
);
