import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { compareText } from "./canonical-json.js";
import type { Ajv2020 } from "ajv/dist/2020.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "./schema-registry.js";
import {
  expectedSourceContentTypes,
  isCanonicalSourceId,
  resolveCanonicalSourceUrl,
  sourceDefinitionPolicyFailures,
} from "./source-network-policy.js";
import type { SourceDefinition } from "./contracts.js";

const canonicalDirectories = [
  "catalog",
  "fixtures",
  "sources/definitions",
  "sources/snapshots",
  "templates",
];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function snapshotFailures(path: string, document: unknown): string[] {
  if (
    !isObject(document) ||
    document["$schema"] !== "urn:mcgen:schema:source-snapshot:1"
  ) {
    return [];
  }
  const sources = Array.isArray(document["sources"]) ? document["sources"] : [];
  const entries = Array.isArray(document["entries"]) ? document["entries"] : [];
  const failures: string[] = [];
  const coordinates = new Set<string>();
  if (document["provenanceVersion"] === 1) {
    sources.forEach((value, index) => {
      if (!isObject(value)) return;
      const sourceId = value["sourceId"];
      const requestedUrl = value["requestedUrl"];
      const finalUrl = value["url"];
      const redirectChain = value["redirectChain"];
      const contentType = value["contentType"];
      if (
        typeof sourceId !== "string" ||
        !isCanonicalSourceId(sourceId) ||
        typeof requestedUrl !== "string" ||
        typeof finalUrl !== "string" ||
        !Array.isArray(redirectChain)
      ) {
        return;
      }
      if (redirectChain[0] !== requestedUrl) {
        failures.push(
          `${path}/sources/${index} redirect chain omits request url`,
        );
      }
      if (redirectChain.at(-1) !== finalUrl) {
        failures.push(
          `${path}/sources/${index} redirect chain omits final url`,
        );
      }
      for (const value of redirectChain) {
        if (typeof value !== "string") continue;
        try {
          resolveCanonicalSourceUrl(sourceId, value);
        } catch {
          failures.push(
            `${path}/sources/${index} redirect chain is outside the approved policy`,
          );
          break;
        }
      }
      const mediaType =
        typeof contentType === "string"
          ? contentType.split(";", 1)[0]?.trim().toLowerCase()
          : undefined;
      if (
        !mediaType ||
        !expectedSourceContentTypes(sourceId).includes(mediaType)
      ) {
        failures.push(
          `${path}/sources/${index} content type is outside the approved policy`,
        );
      }
    });
  }
  let previousCatalogKey = "";
  let previousVersion = "";
  entries.forEach((value, index) => {
    if (!isObject(value)) return;
    const coordinate = value["coordinate"];
    if (typeof coordinate === "string") {
      if (coordinates.has(coordinate)) {
        failures.push(`${path}/entries/${index}/coordinate is duplicated`);
      }
      coordinates.add(coordinate);
    }
    const sourceIndexes = Array.isArray(value["sourceIndexes"])
      ? value["sourceIndexes"]
      : [];
    for (const sourceIndex of sourceIndexes) {
      if (
        typeof sourceIndex === "number" &&
        Number.isInteger(sourceIndex) &&
        sourceIndex >= sources.length
      ) {
        failures.push(
          `${path}/entries/${index}/sourceIndexes references missing source ${sourceIndex}`,
        );
      }
    }
    if (
      typeof value["catalogKey"] === "string" &&
      typeof value["version"] === "string"
    ) {
      const catalogKey = value["catalogKey"];
      const version = value["version"];
      const order = compareText(previousCatalogKey, catalogKey);
      if (
        previousCatalogKey &&
        (order > 0 ||
          (order === 0 && compareText(previousVersion, version) > 0))
      ) {
        failures.push(
          `${path}/entries/${index} is not deterministically sorted`,
        );
      }
      previousCatalogKey = catalogKey;
      previousVersion = version;
    }
  });
  return failures;
}

async function collectJsonFiles(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const child = resolve(path, entry.name);
        if (entry.isDirectory()) return collectJsonFiles(child);
        return entry.isFile() && extname(entry.name) === ".json" ? [child] : [];
      }),
    );
    return nested.flat().sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }
}

export async function validateFiles(
  paths: readonly string[],
): Promise<string[]> {
  const ajv = await createSchemaRegistry();
  const failures: string[] = [];
  for (const path of paths) {
    const document = JSON.parse(await readFile(path, "utf8")) as unknown;
    failures.push(...documentFailures(ajv, path, document));
  }
  return failures;
}

export function documentFailures(
  ajv: Ajv2020,
  path: string,
  document: unknown,
): string[] {
  const result = validateWithSchema(ajv, document);
  const failures = result.errors.map(
    (error) =>
      `${path}${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
  );
  if (
    isObject(document) &&
    document["$schema"] === "urn:mcgen:schema:source-definition:1" &&
    result.valid
  ) {
    failures.push(
      ...sourceDefinitionPolicyFailures(document as SourceDefinition).map(
        (failure) => `${path} ${failure}`,
      ),
    );
  }
  failures.push(...snapshotFailures(path, document));
  return failures;
}

export async function canonicalJsonFiles(): Promise<string[]> {
  const nested = await Promise.all(
    canonicalDirectories.map((path) =>
      collectJsonFiles(resolve(repositoryRoot, path)),
    ),
  );
  return nested.flat().sort((left, right) => left.localeCompare(right));
}
