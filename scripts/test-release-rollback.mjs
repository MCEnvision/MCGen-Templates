import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const index = process.argv.indexOf("--dir");
const sourceDirectory = resolve(
  process.cwd(),
  index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : ".",
);
const archivePath = join(sourceDirectory, "mcgen-template-pack.zip");
const original = await readFile(archivePath);
const originalDigest = createHash("sha256").update(original).digest("hex");
const manifest = JSON.parse(
  await readFile(join(sourceDirectory, "pack-manifest.json"), "utf8"),
);
const quarantine = await mkdtemp(join(tmpdir(), "mcgen-pack-quarantine-"));
try {
  const candidate = join(quarantine, "mcgen-template-pack.zip");
  for (const name of await readdir(sourceDirectory)) {
    if (name !== "rollback-test.json") {
      await copyFile(join(sourceDirectory, name), join(quarantine, name));
    }
  }
  const mutated = Buffer.from(original);
  mutated[mutated.length - 1] ^= 1;
  await writeFile(candidate, mutated);
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-pack-offline.mjs", "--dir", quarantine],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (result.status === 0) {
    throw new Error("mutated release candidate was accepted");
  }
  const after = await readFile(archivePath);
  const afterDigest = createHash("sha256").update(after).digest("hex");
  if (afterDigest !== originalDigest) {
    throw new Error("rollback test changed the original release candidate");
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        $schema: "urn:mcgen:verification:release-rollback:1",
        status: "passed",
        packVersion: manifest.packVersion,
        sourceCommit: manifest.sourceCommit,
        originalArchiveSha256: originalDigest,
        mutation: "archive byte corruption",
        recovery: "quarantine the candidate and preserve the prior release",
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await rm(quarantine, { recursive: true, force: true });
}
