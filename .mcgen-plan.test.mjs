import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = await readFile("docs/general/plan.md", "utf8");

test("plan verification", () => {
  const fenceCount = text.split("\n").filter((line) => line.startsWith("```")).length;
  assert.equal(fenceCount % 2, 0);
  assert.ok(text.split("\n").every((line) => line === line.trimEnd()));
  assert.ok(text.includes("## 7.4 Canonical Branch Matrix Rollout"));
});
