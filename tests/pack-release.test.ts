import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("phase six release input", () => {
  it("selects a deterministic approved file set from the checked out commit", async () => {
    const temporary = await mkdtemp(join(tmpdir(), "mcgen-pack-input-test-"));
    const output = join(temporary, "input.json");
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/create-pack-input.mjs",
          "--pack-version",
          "1.0.0-beta.1",
          "--output",
          output,
        ],
        { cwd: repositoryRoot, encoding: "utf8" },
      );
      const input = JSON.parse(await readFile(output, "utf8")) as {
        sourceCommit: string;
        catalogSnapshot: string;
        files: { path: string }[];
      };
      const head = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repositoryRoot,
        encoding: "utf8",
      }).trim();
      expect(input.sourceCommit).toBe(head);
      expect(input.catalogSnapshot).toBe("2026-08-11-r1");
      expect(input.files.length).toBeGreaterThan(2000);
      expect(input.files.map((file) => file.path)).toEqual(
        [...input.files.map((file) => file.path)].sort((left, right) =>
          left.localeCompare(right),
        ),
      );
      expect(
        input.files.every((file) => !file.path.startsWith(".github/")),
      ).toBe(true);
      expect(
        input.files.every(
          (file) => !file.path.startsWith("verification/phase6/"),
        ),
      ).toBe(true);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
});
