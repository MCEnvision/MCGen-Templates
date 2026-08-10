#!/usr/bin/env node
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { canonicalJson } from "./canonical-json.js";
import { fetchResource } from "./fetch-resource.js";
import { createSchemaRegistry, repositoryRoot } from "./schema-registry.js";
import { loadSourceDefinition } from "./source-definition.js";
import { buildForgeSnapshot } from "./sources/forge.js";
import {
  canonicalJsonFiles,
  documentFailures,
  validateFiles,
} from "./validate.js";

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireRepositoryPath(path: string): string {
  const absolute = resolve(repositoryRoot, path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (repositoryRelative.startsWith("..") || repositoryRelative === "") {
    throw new Error("output path must be a file inside the repository");
  }
  return absolute;
}

function requireForgeSnapshotPath(path: string): string {
  const absolute = requireRepositoryPath(path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    !repositoryRelative.startsWith("sources/snapshots/forge/") ||
    !repositoryRelative.endsWith(".json")
  ) {
    throw new Error(
      "forge snapshots must use a json file under sources/snapshots/forge",
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

async function snapshotForge(args: readonly string[]): Promise<void> {
  const output = option(args, "--output");
  if (!output) {
    throw new Error("snapshot forge requires --output <repository path>");
  }
  const outputPath = requireForgeSnapshotPath(output);
  await requireUnusedPath(outputPath);
  const definition = await loadSourceDefinition("forge");
  const mojangUrl = definition.prerequisiteUrls[0];
  if (!mojangUrl) {
    throw new Error("forge source definition requires the mojang manifest url");
  }
  const [mojang, forge] = await Promise.all([
    fetchResource(mojangUrl, definition.requestPolicy),
    fetchResource(definition.primaryUrl, definition.requestPolicy),
  ]);
  const snapshot = buildForgeSnapshot(mojang, forge, new Date().toISOString());
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
    `captured ${snapshot.entries.length} forge versions with ${snapshot.rejected.length} rejected entries\n`,
  );
}

async function main(): Promise<void> {
  const [command, subject, ...args] = process.argv.slice(2);
  if (command === "validate") {
    await validate(subject ? [subject, ...args] : args);
    return;
  }
  if (command === "snapshot" && subject === "forge") {
    await snapshotForge(args);
    return;
  }
  throw new Error(
    "usage: mcgen-template-tool validate [paths...] or snapshot forge --output <path>",
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
