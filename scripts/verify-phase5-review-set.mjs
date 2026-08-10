import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const expectedIndex = process.argv.indexOf("--expected");
const actualIndex = process.argv.indexOf("--actual");
if (expectedIndex < 0 || actualIndex < 0)
  throw new Error("phase 5 review set requires --expected and --actual");
const expectedRoot = resolve(process.cwd(), process.argv[expectedIndex + 1]);
const actualRoot = resolve(process.cwd(), process.argv[actualIndex + 1]);
const names = async (root) =>
  (await readdir(root)).filter((name) => name.endsWith(".json")).sort();
const expectedNames = await names(expectedRoot);
const actualNames = await names(actualRoot);
if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames))
  throw new Error(
    "fresh phase 5 evidence does not cover the committed tuple set",
  );
for (const name of expectedNames) {
  const expected = JSON.parse(await readFile(join(expectedRoot, name), "utf8"));
  const actual = JSON.parse(await readFile(join(actualRoot, name), "utf8"));
  if (actual.status !== "verified") throw new Error(`${name} is not verified`);
  if (
    actual.key?.digest !== expected.key?.digest ||
    JSON.stringify(actual.key?.identity) !==
      JSON.stringify(expected.key?.identity)
  )
    throw new Error(`${name} tuple identity differs from committed evidence`);
}
