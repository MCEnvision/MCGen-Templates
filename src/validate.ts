import { readFile, readdir, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import type { Ajv2020 } from "ajv/dist/2020.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "./schema-registry.js";
import {
  expectedSourceContentTypes,
  isCanonicalSourceId,
  resolveCapturedSourceUrl,
  sourceDefinitionPolicyFailures,
} from "./source-network-policy.js";
import { sourceAdapterFailures } from "./source-adapters.js";
import type { SourceDefinition } from "./contracts.js";

const canonicalDirectories = [
  "catalog",
  "fixtures",
  "profiles",
  "sources/definitions",
  "sources/snapshots",
  "templates",
];

type JsonObject = Record<string, unknown>;

type LoadedDocument = {
  path: string;
  document: unknown;
};

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function documentSchema(value: unknown): string | undefined {
  return isObject(value) && typeof value["$schema"] === "string"
    ? value["$schema"]
    : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function integerArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is number =>
          typeof item === "number" && Number.isInteger(item),
      )
    : [];
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function entryReferenceKey(snapshotId: string, entryIndex: number): string {
  return `${snapshotId}:${entryIndex}`;
}

function rejectedReferenceKey(
  snapshotId: string,
  rejectedIndex: number,
): string {
  return `${snapshotId}:${rejectedIndex}`;
}

function snapshotRejectionPlatform(snapshot: JsonObject): string | undefined {
  const platforms = [
    ...new Set(
      objects(snapshot["entries"])
        .map((entry) => entry["platform"])
        .filter((platform): platform is string => typeof platform === "string"),
    ),
  ];
  if (platforms.length === 1) return platforms[0];
  const adapter = snapshot["adapter"];
  return isObject(adapter) && typeof adapter["id"] === "string"
    ? adapter["id"]
    : undefined;
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
  const rejected = Array.isArray(document["rejected"])
    ? document["rejected"]
    : [];
  const failures: string[] = [];
  const catalogCoordinates = new Set<string>();
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
      const role = value["role"];
      const derivedFrom = value["derivedFrom"];
      for (const redirectUrl of redirectChain) {
        if (typeof redirectUrl !== "string") continue;
        try {
          const captured = { sourceId, url: redirectUrl };
          const capturedRole =
            role === "primary" ||
            role === "prerequisite" ||
            role === "corroborating"
              ? role
              : undefined;
          const capturedProvenance = isObject(derivedFrom)
            ? {
                sourceId:
                  typeof derivedFrom["sourceId"] === "string"
                    ? derivedFrom["sourceId"]
                    : "",
                sha256:
                  typeof derivedFrom["sha256"] === "string"
                    ? derivedFrom["sha256"]
                    : "",
                selector:
                  typeof derivedFrom["selector"] === "string"
                    ? derivedFrom["selector"]
                    : "",
              }
            : undefined;
          resolveCapturedSourceUrl({
            ...captured,
            ...(capturedRole ? { role: capturedRole } : {}),
            ...(capturedProvenance ? { derivedFrom: capturedProvenance } : {}),
          });
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
  let previousComponent = "";
  let previousVersion = "";
  let previousCoordinate = "";
  entries.forEach((value, index) => {
    if (!isObject(value)) return;
    const platform = value["platform"];
    const catalogKey = value["catalogKey"];
    const component = value["component"];
    const coordinate = value["coordinate"];
    if (
      typeof platform === "string" &&
      typeof catalogKey === "string" &&
      typeof component === "string" &&
      typeof coordinate === "string"
    ) {
      const identity = `${platform}:${catalogKey}:${component}:${coordinate}`;
      if (catalogCoordinates.has(identity)) {
        failures.push(`${path}/entries/${index}/coordinate is duplicated`);
      }
      catalogCoordinates.add(identity);
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
      typeof value["component"] === "string" &&
      typeof value["version"] === "string"
    ) {
      const catalogKey = value["catalogKey"];
      const component = value["component"];
      const version = value["version"];
      const order = compareText(previousCatalogKey, catalogKey);
      if (
        previousCatalogKey &&
        (order > 0 ||
          (order === 0 &&
            (compareText(previousComponent, component) > 0 ||
              (previousComponent === component &&
                (compareText(previousVersion, version) > 0 ||
                  (previousVersion === version &&
                    typeof value["coordinate"] === "string" &&
                    compareText(previousCoordinate, value["coordinate"]) >
                      0))))))
      ) {
        failures.push(
          `${path}/entries/${index} is not deterministically sorted`,
        );
      }
      previousCatalogKey = catalogKey;
      previousComponent = component;
      previousVersion = version;
      previousCoordinate =
        typeof value["coordinate"] === "string" ? value["coordinate"] : "";
    }
  });
  rejected.forEach((value, index) => {
    if (!isObject(value)) return;
    const sourceIndex = value["sourceIndex"];
    if (
      typeof sourceIndex === "number" &&
      Number.isInteger(sourceIndex) &&
      sourceIndex >= sources.length
    ) {
      failures.push(
        `${path}/rejected/${index}/sourceIndex references missing source ${sourceIndex}`,
      );
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
        if (entry.isDirectory()) {
          return entry.name.startsWith(".") ? [] : collectJsonFiles(child);
        }
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

function catalogComponentFailurePrefix(path: string, index: number): string {
  return `${path}/components/${index}`;
}

function sorted(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      index === 0 || compareText(values[index - 1] ?? "", value) <= 0,
  );
}

async function catalogIntegrityFailures(
  ajv: Ajv2020,
  initial: readonly LoadedDocument[],
): Promise<string[]> {
  const failures: string[] = [];
  const documents = new Map(initial.map((item) => [item.path, item]));
  const catalogDocuments = initial.filter(
    (item) =>
      documentSchema(item.document)?.startsWith("urn:mcgen:schema:catalog") ??
      false,
  );
  if (catalogDocuments.length === 0) return failures;

  async function load(
    reference: string,
    owner: string,
  ): Promise<LoadedDocument | undefined> {
    const path = resolve(repositoryRoot, reference);
    if (!path.startsWith(`${repositoryRoot}/`)) {
      failures.push(`${owner} references a path outside the repository`);
      return undefined;
    }
    const known = documents.get(path);
    if (known) return known;
    try {
      const document = JSON.parse(await readFile(path, "utf8")) as unknown;
      const loaded = { path, document };
      documents.set(path, loaded);
      failures.push(...documentFailures(ajv, path, document));
      return loaded;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        failures.push(`${owner} references missing document ${reference}`);
        return undefined;
      }
      throw error;
    }
  }

  function digestMatches(
    owner: string,
    document: unknown,
    digest: unknown,
  ): void {
    if (
      typeof digest !== "string" ||
      sha256(canonicalJson(document)) !== digest
    ) {
      failures.push(`${owner} digest does not match the referenced document`);
    }
  }

  const rootIndexes = catalogDocuments.filter(
    (item) =>
      documentSchema(item.document) === "urn:mcgen:schema:catalog-index:1",
  );
  if (rootIndexes.length === 0) {
    failures.push("catalog documents require a catalog root index");
    return failures;
  }

  const activeCatalogRoots = new Set(
    initial.flatMap((item) => {
      if (!item.path.includes("/profiles/") || !isObject(item.document))
        return [];
      const catalog = item.document["catalog"];
      if (!isObject(catalog) || typeof catalog["indexPath"] !== "string")
        return [];
      return [resolve(repositoryRoot, catalog["indexPath"])];
    }),
  );

  const reachable = new Set<string>();
  for (const root of rootIndexes) {
    reachable.add(root.path);
    const activeRoot = activeCatalogRoots.has(root.path);
    const index = root.document;
    if (!isObject(index)) continue;
    const catalogId = index["id"];
    const sourceSnapshots = objects(index["sourceSnapshots"]);
    const snapshotById = new Map<string, JsonObject>();
    const sourceIds = sourceSnapshots
      .map((reference) => reference["id"])
      .filter((value): value is string => typeof value === "string");
    if (new Set(sourceIds).size !== sourceIds.length || !sorted(sourceIds)) {
      failures.push(
        `${root.path}/sourceSnapshots must be unique and sorted by id`,
      );
    }
    for (const reference of sourceSnapshots) {
      const path = reference["path"];
      const id = reference["id"];
      if (typeof path !== "string" || typeof id !== "string") continue;
      const loaded = await load(path, root.path);
      if (!loaded) continue;
      reachable.add(loaded.path);
      if (
        documentSchema(loaded.document) !== "urn:mcgen:schema:source-snapshot:1"
      ) {
        failures.push(
          `${root.path} source snapshot ${path} is not a source snapshot`,
        );
        continue;
      }
      digestMatches(
        `${root.path} source snapshot ${path}`,
        loaded.document,
        reference["digest"],
      );
      if (!isObject(loaded.document) || loaded.document["snapshotId"] !== id) {
        failures.push(
          `${root.path} source snapshot ${path} does not match id ${id}`,
        );
        continue;
      }
      snapshotById.set(id, loaded.document);
    }

    const policyReference = index["recommendationPolicy"];
    if (
      isObject(policyReference) &&
      typeof policyReference["path"] === "string"
    ) {
      const loaded = await load(policyReference["path"], root.path);
      if (loaded) {
        reachable.add(loaded.path);
        if (
          documentSchema(loaded.document) !==
          "urn:mcgen:schema:catalog-recommendation-policy:1"
        ) {
          failures.push(
            `${root.path} references a non policy recommendation document`,
          );
        }
        digestMatches(
          `${root.path} recommendation policy`,
          loaded.document,
          policyReference["sha256"],
        );
      }
    }

    const shardById = new Map<string, JsonObject>();
    const platformReferences = objects(index["platforms"]);
    const platformNames = platformReferences
      .map((reference) => reference["platform"])
      .filter((value): value is string => typeof value === "string");
    if (
      new Set(platformNames).size !== platformNames.length ||
      !sorted(platformNames)
    ) {
      failures.push(
        `${root.path}/platforms must be unique and sorted by platform`,
      );
    }
    for (const reference of platformReferences) {
      const platform = reference["platform"];
      const path = reference["path"];
      if (typeof platform !== "string" || typeof path !== "string") continue;
      const loaded = await load(path, root.path);
      if (!loaded) continue;
      reachable.add(loaded.path);
      if (
        documentSchema(loaded.document) !==
        "urn:mcgen:schema:catalog-platform-index:1"
      ) {
        failures.push(
          `${root.path} platform ${platform} is not a platform index`,
        );
        continue;
      }
      digestMatches(
        `${root.path} platform ${platform}`,
        loaded.document,
        reference["sha256"],
      );
      if (!isObject(loaded.document)) continue;
      if (
        loaded.document["catalogId"] !== catalogId ||
        loaded.document["platform"] !== platform
      ) {
        failures.push(
          `${root.path} platform ${platform} does not belong to the root catalog`,
        );
      }
      const shardReferences = objects(loaded.document["shards"]);
      const keys = shardReferences
        .map((shard) => shard["key"])
        .filter((value): value is string => typeof value === "string");
      if (new Set(keys).size !== keys.length || !sorted(keys)) {
        failures.push(`${loaded.path}/shards must be unique and sorted by key`);
      }
      for (const shardReference of shardReferences) {
        const shardPath = shardReference["path"];
        const shardId = shardReference["id"];
        if (typeof shardPath !== "string" || typeof shardId !== "string")
          continue;
        const shardLoaded = await load(shardPath, loaded.path);
        if (!shardLoaded) continue;
        reachable.add(shardLoaded.path);
        if (
          documentSchema(shardLoaded.document) !== "urn:mcgen:schema:catalog:1"
        ) {
          failures.push(
            `${loaded.path} shard ${shardPath} is not a catalog shard`,
          );
          continue;
        }
        digestMatches(
          `${loaded.path} shard ${shardPath}`,
          shardLoaded.document,
          shardReference["sha256"],
        );
        if (!isObject(shardLoaded.document)) continue;
        if (
          shardLoaded.document["id"] !== shardId ||
          shardLoaded.document["catalogId"] !== catalogId ||
          shardLoaded.document["platform"] !== platform ||
          shardLoaded.document["key"] !== shardReference["key"]
        ) {
          failures.push(
            `${loaded.path} shard ${shardPath} does not match its index reference`,
          );
        }
        if (
          Buffer.byteLength(canonicalJson(shardLoaded.document)) !==
          shardReference["bytes"]
        ) {
          failures.push(
            `${loaded.path} shard ${shardPath} byte length does not match`,
          );
        }
        shardById.set(shardId, shardLoaded.document);
      }
    }

    const catalogComponentById = new Map<
      string,
      { component: JsonObject; shard: JsonObject }
    >();
    for (const shard of shardById.values()) {
      for (const component of objects(shard["components"])) {
        if (typeof component["id"] === "string") {
          catalogComponentById.set(component["id"], { component, shard });
        }
      }
    }

    for (const [shardId, shard] of shardById) {
      if (
        "profileBinding" in shard ||
        "family" in shard ||
        "profile" in shard
      ) {
        failures.push(
          `${shardId} contains a template family or profile binding`,
        );
      }
      const shardSources = stringArray(shard["sourceSnapshots"]);
      for (const sourceId of shardSources) {
        if (!snapshotById.has(sourceId)) {
          failures.push(
            `${shardId} references an unknown source snapshot ${sourceId}`,
          );
        }
      }
      const components = objects(shard["components"]);
      const componentById = new Map<string, JsonObject>();
      components.forEach((component, index) => {
        const prefix = catalogComponentFailurePrefix(shardId, index);
        const componentId = component["id"];
        if (typeof componentId === "string")
          componentById.set(componentId, component);
        if (component["status"] !== "discovered") {
          failures.push(
            `${prefix} is not source discovered and cannot support a recommendation`,
          );
        }
        for (const reference of objects(component["sourceEntries"])) {
          const snapshotId = reference["snapshotId"];
          const entryIndex = reference["entryIndex"];
          if (typeof snapshotId !== "string" || typeof entryIndex !== "number")
            continue;
          const snapshot = snapshotById.get(snapshotId);
          const snapshotEntries = snapshot
            ? Array.isArray(snapshot["entries"])
              ? (snapshot["entries"] as unknown[])
              : []
            : [];
          const entry = snapshotEntries[entryIndex];
          if (!isObject(entry)) {
            failures.push(
              `${prefix} references a missing source entry ${snapshotId}:${entryIndex}`,
            );
            continue;
          }
          if (entry["platform"] !== shard["platform"]) {
            failures.push(
              `${prefix} source entry does not match shard platform`,
            );
          }
          if (entry["catalogKey"] !== shard["key"]) {
            failures.push(
              `${prefix} source entry does not match shard catalog key`,
            );
          }
          for (const key of [
            "component",
            "version",
            "coordinate",
            "channel",
          ] as const) {
            if (entry[key] !== component[key]) {
              failures.push(
                `${prefix} source entry does not match component ${key}`,
              );
            }
          }
          if (
            (entry["compatibility"] ?? "declared") !==
            (component["compatibility"] ?? "declared")
          ) {
            failures.push(
              `${prefix} source entry does not match component compatibility`,
            );
          }
          const entrySourceIndexes = Array.isArray(entry["sourceIndexes"])
            ? entry["sourceIndexes"]
            : [];
          for (const sourceIndex of integerArray(reference["sourceIndexes"])) {
            if (!entrySourceIndexes.includes(sourceIndex)) {
              failures.push(
                `${prefix} source entry has an invalid source index`,
              );
            }
          }
        }
      });
      const edges = objects(shard["edges"]);
      const expectedEdges =
        shard["keyKind"] === "global" || shard["keyKind"] === "unresolved"
          ? 0
          : components.length;
      if (edges.length !== expectedEdges) {
        failures.push(
          `${shardId} must have exactly one observed target edge per component`,
        );
      }
      for (const edge of edges) {
        const component =
          typeof edge["to"] === "string"
            ? componentById.get(edge["to"])
            : undefined;
        if (
          shard["keyKind"] === "global" ||
          shard["keyKind"] === "unresolved" ||
          edge["kind"] !== "targets" ||
          edge["confidence"] !== "published" ||
          !component ||
          typeof edge["from"] !== "string" ||
          !edge["from"].startsWith(`target.${String(shard["platform"])}.`)
        ) {
          failures.push(
            `${shardId} contains a compatibility edge not directly published by its source`,
          );
          continue;
        }
        if (
          canonicalJson(edge["sourceEntries"]) !==
          canonicalJson(component["sourceEntries"])
        ) {
          failures.push(
            `${shardId} target edge evidence does not match its component`,
          );
        }
      }
    }

    const coverageReference = index["coverage"];
    if (
      isObject(coverageReference) &&
      typeof coverageReference["path"] === "string"
    ) {
      const loaded = await load(coverageReference["path"], root.path);
      if (loaded) {
        reachable.add(loaded.path);
        if (
          documentSchema(loaded.document) !==
          "urn:mcgen:schema:coverage-report:1"
        ) {
          failures.push(`${root.path} coverage is not a coverage report`);
        }
        digestMatches(
          `${root.path} coverage`,
          loaded.document,
          coverageReference["sha256"],
        );
        if (isObject(loaded.document)) {
          if (loaded.document["catalogId"] !== catalogId) {
            failures.push(`${root.path} coverage belongs to another catalog`);
          }
          const tracksRejectedRecords =
            loaded.document["rejectionAccountingVersion"] === 1;
          const tracksComponentMappings =
            loaded.document["coverageMappingVersion"] === 1;
          const covered = new Map<string, JsonObject>();
          const rejectedCovered = new Map<string, JsonObject>();
          const coverageSnapshots = new Map<string, JsonObject>();
          for (const reference of objects(loaded.document["sourceSnapshots"])) {
            const snapshotId = reference["id"];
            if (typeof snapshotId !== "string") continue;
            if (coverageSnapshots.has(snapshotId)) {
              failures.push(
                `${root.path} coverage repeats source snapshot ${snapshotId}`,
              );
            }
            coverageSnapshots.set(snapshotId, reference);
            const snapshot = snapshotById.get(snapshotId);
            if (!snapshot) {
              failures.push(
                `${root.path} coverage references an unknown source snapshot ${snapshotId}`,
              );
              continue;
            }
            const entries = Array.isArray(snapshot["entries"])
              ? snapshot["entries"]
              : [];
            const rejected = Array.isArray(snapshot["rejected"])
              ? snapshot["rejected"]
              : [];
            if (reference["entries"] !== entries.length) {
              failures.push(
                `${root.path} coverage totals do not match source snapshot ${snapshotId}`,
              );
            }
            if (
              tracksRejectedRecords &&
              (typeof reference["rejected"] !== "number" ||
                reference["rejected"] !== rejected.length)
            ) {
              failures.push(
                `${root.path} coverage rejected totals do not match source snapshot ${snapshotId}`,
              );
            }
          }
          for (const snapshotId of snapshotById.keys()) {
            if (!coverageSnapshots.has(snapshotId)) {
              failures.push(
                `${root.path} coverage omits source snapshot ${snapshotId}`,
              );
            }
          }
          for (const platform of objects(loaded.document["platforms"])) {
            const platformName = platform["platform"];
            if (
              tracksRejectedRecords &&
              typeof platform["rejected"] !== "number"
            ) {
              failures.push(
                `${root.path} rejection accounting platform total is missing`,
              );
            }
            const entries = objects(platform["entries"]);
            const recomputedStatuses: Record<string, number> = {};
            let represented = 0;
            for (const entry of entries) {
              const snapshotId = entry["snapshotId"];
              const entryIndex = entry["entryIndex"];
              if (
                typeof snapshotId !== "string" ||
                typeof entryIndex !== "number"
              )
                continue;
              const key = entryReferenceKey(snapshotId, entryIndex);
              if (covered.has(key))
                failures.push(`${root.path} coverage repeats ${key}`);
              covered.set(key, entry);
              if (entry["disposition"] === "represented") {
                represented += 1;
                const shard =
                  typeof entry["shardId"] === "string"
                    ? shardById.get(entry["shardId"])
                    : undefined;
                if (!shard || platformName !== shard["platform"]) {
                  failures.push(
                    `${root.path} coverage representation has no matching shard`,
                  );
                }
                if (tracksComponentMappings) {
                  const componentId = entry["componentId"];
                  const mapping =
                    typeof componentId === "string"
                      ? catalogComponentById.get(componentId)
                      : undefined;
                  if (!mapping || !shard || mapping.shard !== shard) {
                    failures.push(
                      `${root.path} coverage mapping has no matching component`,
                    );
                  }
                  const componentReferences = mapping
                    ? objects(mapping.component["sourceEntries"])
                    : [];
                  if (
                    !componentReferences.some(
                      (reference) =>
                        reference["snapshotId"] === snapshotId &&
                        reference["entryIndex"] === entryIndex,
                    )
                  ) {
                    failures.push(
                      `${root.path} coverage mapping does not reference its source entry`,
                    );
                  }
                  const verificationStatus = entry["verificationStatus"];
                  if (
                    verificationStatus !== "verified" &&
                    verificationStatus !== "legacy-verified" &&
                    verificationStatus !== "blocked"
                  ) {
                    failures.push(
                      `${root.path} coverage mapping has an invalid verification status`,
                    );
                  } else {
                    recomputedStatuses[verificationStatus] =
                      (recomputedStatuses[verificationStatus] ?? 0) + 1;
                  }
                  const resolution = entry["resolution"];
                  if (!isObject(resolution)) {
                    failures.push(
                      `${root.path} coverage mapping is missing its resolution`,
                    );
                  } else if (verificationStatus === "blocked") {
                    const blockerId = resolution["blockerId"];
                    const blockerIds = new Set(
                      objects(platform["blockers"])
                        .map((blocker) => blocker["id"])
                        .filter((id): id is string => typeof id === "string"),
                    );
                    if (
                      resolution["kind"] !== "blocker" ||
                      typeof blockerId !== "string" ||
                      !blockerIds.has(blockerId)
                    ) {
                      failures.push(
                        `${root.path} blocked coverage mapping does not identify a platform blocker`,
                      );
                    }
                  } else if (
                    verificationStatus === "verified" ||
                    verificationStatus === "legacy-verified"
                  ) {
                    if (!activeRoot) continue;
                    const evidence = objects(resolution["evidence"]);
                    if (
                      resolution["kind"] !== "exact-evidence" ||
                      evidence.length === 0
                    ) {
                      failures.push(
                        `${root.path} verified coverage mapping does not identify exact evidence`,
                      );
                    }
                    const tupleIds = new Set<string>();
                    for (const reference of evidence) {
                      const tupleId = reference["tupleId"];
                      const evidencePath = reference["evidencePath"];
                      const evidenceDigest = reference["evidenceDigest"];
                      const evidenceStatus = reference["status"];
                      if (
                        typeof tupleId !== "string" ||
                        typeof evidencePath !== "string" ||
                        typeof evidenceDigest !== "string" ||
                        (evidenceStatus !== "verified" &&
                          evidenceStatus !== "legacy-verified") ||
                        tupleIds.has(tupleId) ||
                        !evidencePath.startsWith(
                          "verification/phase5/evidence/",
                        ) ||
                        evidencePath.includes("..")
                      ) {
                        failures.push(
                          `${root.path} exact coverage evidence reference is invalid`,
                        );
                        continue;
                      }
                      tupleIds.add(tupleId);
                      const evidenceDocument = await load(
                        evidencePath,
                        root.path,
                      );
                      if (!evidenceDocument) continue;
                      if (
                        documentSchema(evidenceDocument.document) !==
                        "urn:mcgen:schema:tuple-evidence:1"
                      ) {
                        failures.push(
                          `${root.path} exact coverage evidence is not a tuple evidence record`,
                        );
                        continue;
                      }
                      digestMatches(
                        `${root.path} exact coverage evidence ${evidencePath}`,
                        evidenceDocument.document,
                        evidenceDigest,
                      );
                      const evidenceRecord = isObject(evidenceDocument.document)
                        ? evidenceDocument.document
                        : {};
                      if (
                        evidenceRecord["status"] !== evidenceStatus ||
                        !isObject(evidenceRecord["key"])
                      ) {
                        failures.push(
                          `${root.path} exact coverage evidence status or key does not match`,
                        );
                        continue;
                      }
                      const key = evidenceRecord["key"];
                      const identity = isObject(key["identity"])
                        ? key["identity"]
                        : {};
                      const identityComponents = isObject(
                        identity["components"],
                      )
                        ? identity["components"]
                        : {};
                      const components = Object.values(identityComponents);
                      if (key["digest"] !== tupleId) {
                        failures.push(
                          `${root.path} exact coverage evidence tuple identity does not match`,
                        );
                      }
                      const snapshotEntries = snapshotById.get(snapshotId);
                      const sourceEntry = snapshotEntries
                        ? objects(snapshotEntries["entries"])[entryIndex]
                        : undefined;
                      const sourceCoordinate = sourceEntry?.["coordinate"];
                      const sourceVersion =
                        typeof sourceCoordinate === "string"
                          ? sourceCoordinate.slice(
                              sourceCoordinate.lastIndexOf(":") + 1,
                            )
                          : undefined;
                      if (
                        identity["catalogKey"] !==
                          sourceEntry?.["catalogKey"] ||
                        (typeof sourceCoordinate === "string" &&
                          !components.includes(sourceCoordinate) &&
                          !components.includes(sourceVersion))
                      ) {
                        failures.push(
                          `${root.path} exact coverage evidence does not cover the source component`,
                        );
                      }
                    }
                  }
                } else {
                  recomputedStatuses["discovered"] =
                    (recomputedStatuses["discovered"] ?? 0) + 1;
                }
              } else {
                failures.push(
                  `${root.path} coverage entries must represent accepted source entries`,
                );
              }
            }
            if (
              platform["discovered"] !== entries.length ||
              platform["represented"] !== represented
            ) {
              failures.push(
                `${root.path} coverage accepted totals do not match platform entries`,
              );
            }
            let rejected = 0;
            for (const blocker of tracksRejectedRecords
              ? objects(platform["blockers"])
              : []) {
              if (!("rejectedEntries" in blocker)) continue;
              const rejectedEntries = objects(blocker["rejectedEntries"]);
              if (rejectedEntries.length !== 1) {
                failures.push(
                  `${root.path} coverage blocker must identify exactly one rejected source record`,
                );
                continue;
              }
              const reference = rejectedEntries[0] ?? {};
              const snapshotId = reference["snapshotId"];
              const rejectedIndex = reference["rejectedIndex"];
              const sourceIndex = reference["sourceIndex"];
              if (
                typeof snapshotId !== "string" ||
                typeof rejectedIndex !== "number" ||
                typeof sourceIndex !== "number"
              ) {
                continue;
              }
              const key = rejectedReferenceKey(snapshotId, rejectedIndex);
              if (rejectedCovered.has(key)) {
                failures.push(
                  `${root.path} coverage repeats rejected record ${key}`,
                );
              }
              rejectedCovered.set(key, blocker);
              const snapshot = snapshotById.get(snapshotId);
              const snapshotRejected = snapshot
                ? Array.isArray(snapshot["rejected"])
                  ? (snapshot["rejected"] as unknown[])
                  : []
                : [];
              const rejectedRecord = snapshotRejected[rejectedIndex];
              if (
                !isObject(rejectedRecord) ||
                rejectedRecord["sourceIndex"] !== sourceIndex
              ) {
                failures.push(
                  `${root.path} coverage blocker references a missing or changed rejected source record`,
                );
                continue;
              }
              if (blocker["reason"] !== rejectedRecord["reason"]) {
                failures.push(
                  `${root.path} coverage blocker reason does not match the rejected source record`,
                );
              }
              const evidence = stringArray(blocker["evidence"]);
              const expectedEvidence = [
                `snapshot ${snapshotId}`,
                `rejected record ${rejectedIndex}`,
                `source ${sourceIndex}`,
              ];
              if (
                !expectedEvidence.every((value) => evidence.includes(value))
              ) {
                failures.push(
                  `${root.path} coverage blocker evidence does not identify the rejected source record`,
                );
              }
              if (
                snapshot &&
                platformName !== snapshotRejectionPlatform(snapshot)
              ) {
                failures.push(
                  `${root.path} coverage blocker is assigned to the wrong platform`,
                );
              }
              rejected += 1;
            }
            if (tracksRejectedRecords && platform["rejected"] !== rejected) {
              failures.push(
                `${root.path} coverage rejected totals do not match platform blockers`,
              );
            }
            if (
              canonicalJson(platform["statuses"]) !==
              canonicalJson(recomputedStatuses)
            ) {
              failures.push(
                `${root.path} coverage statuses do not match represented entries`,
              );
            }
            if (
              platform["unexplainedGaps"] instanceof Array &&
              platform["unexplainedGaps"].length > 0
            ) {
              failures.push(`${root.path} coverage contains unexplained gaps`);
            }
          }
          for (const [snapshotId, snapshot] of snapshotById) {
            const entries = Array.isArray(snapshot["entries"])
              ? snapshot["entries"]
              : [];
            entries.forEach((_, entryIndex) => {
              if (!covered.has(entryReferenceKey(snapshotId, entryIndex))) {
                failures.push(
                  `${root.path} coverage omits ${snapshotId}:${entryIndex}`,
                );
              }
            });
            if (tracksRejectedRecords) {
              const rejected = Array.isArray(snapshot["rejected"])
                ? snapshot["rejected"]
                : [];
              rejected.forEach((_, rejectedIndex) => {
                const key = rejectedReferenceKey(snapshotId, rejectedIndex);
                if (!rejectedCovered.has(key)) {
                  failures.push(
                    `${root.path} coverage omits rejected record ${key}`,
                  );
                }
              });
            }
          }
        }
      }
    }
  }

  for (const document of catalogDocuments) {
    if (
      documentSchema(document.document) ===
      "urn:mcgen:schema:catalog-drift-report:1"
    ) {
      continue;
    }
    if (!reachable.has(document.path)) {
      failures.push(
        `${document.path} is not reachable from a catalog root index`,
      );
    }
  }
  return failures;
}

async function phase4IntegrityFailures(
  initial: readonly LoadedDocument[],
): Promise<string[]> {
  const failures: string[] = [];
  const documents = new Map(initial.map((item) => [item.path, item.document]));
  const profileDocuments = initial.filter(
    (item) =>
      documentSchema(item.document) === "urn:mcgen:schema:toolchain-profile:1",
  );
  const profileIds = new Set(
    profileDocuments
      .map((item) =>
        isObject(item.document) ? item.document["id"] : undefined,
      )
      .filter((id): id is string => typeof id === "string"),
  );
  for (const item of initial) {
    if (
      documentSchema(item.document) ===
      "urn:mcgen:schema:toolchain-profile-index:1"
    ) {
      if (!isObject(item.document)) continue;
      const references = objects(item.document["profiles"]);
      const ids = references
        .map((reference) => reference["id"])
        .filter((id): id is string => typeof id === "string");
      if (
        ids.length !== profileIds.size ||
        new Set(ids).size !== ids.length ||
        !sorted(ids)
      ) {
        failures.push(
          `${item.path}/profiles must index every unique profile in sorted order`,
        );
      }
      for (const reference of references) {
        const path = reference["path"];
        const id = reference["id"];
        if (typeof path !== "string" || typeof id !== "string") continue;
        if (!path.startsWith("profiles/") || path.includes("..")) {
          failures.push(`${item.path} profile path is outside profiles`);
          continue;
        }
        const document = documents.get(resolve(repositoryRoot, path));
        if (!document) {
          failures.push(`${item.path} references missing profile ${path}`);
          continue;
        }
        if (!isObject(document) || document["id"] !== id) {
          failures.push(`${item.path} profile id does not match ${path}`);
        }
        if (sha256(canonicalJson(document)) !== reference["sha256"]) {
          failures.push(`${item.path} profile digest does not match ${path}`);
        }
      }
    }
    if (
      documentSchema(item.document) === "urn:mcgen:schema:template-index:1" &&
      isObject(item.document)
    ) {
      const references = objects(item.document["descriptors"]);
      const ids = references
        .map((reference) => reference["id"])
        .filter((id): id is string => typeof id === "string");
      if (new Set(ids).size !== ids.length || !sorted(ids)) {
        failures.push(
          `${item.path}/descriptors must be unique and sorted by id`,
        );
      }
      for (const reference of references) {
        const path = reference["path"];
        const id = reference["id"];
        if (typeof path !== "string" || typeof id !== "string") continue;
        if (!path.startsWith("templates/") || path.includes("..")) {
          failures.push(`${item.path} descriptor path is outside templates`);
          continue;
        }
        const document = documents.get(resolve(repositoryRoot, path));
        if (!document) {
          failures.push(`${item.path} references missing descriptor ${path}`);
          continue;
        }
        if (!isObject(document) || document["id"] !== id) {
          failures.push(`${item.path} descriptor id does not match ${path}`);
        }
        if (sha256(canonicalJson(document)) !== reference["sha256"]) {
          failures.push(
            `${item.path} descriptor digest does not match ${path}`,
          );
        }
      }
    }
    if (
      documentSchema(item.document) ===
        "urn:mcgen:schema:template-descriptor:1" &&
      isObject(item.document)
    ) {
      const refs = stringArray(item.document["profileRefs"]);
      for (const ref of refs) {
        if (!profileIds.has(ref))
          failures.push(`${item.path} references missing profile ${ref}`);
      }
      if (
        item.document["status"] === "blocked" &&
        objects(item.document["blockers"]).length === 0
      ) {
        failures.push(`${item.path} blocked descriptor must declare blockers`);
      }
      const customization = isObject(item.document["customization"])
        ? item.document["customization"]
        : undefined;
      const catalogPaths = customization
        ? stringArray(customization["fieldCatalogPaths"])
        : [];
      const catalogFieldIds = new Set<string>();
      for (const catalogPath of catalogPaths) {
        const catalog = documents.get(resolve(repositoryRoot, catalogPath));
        if (!catalog || !isObject(catalog)) {
          failures.push(
            `${item.path} references missing field catalog ${catalogPath}`,
          );
          continue;
        }
        for (const field of objects(catalog["fields"])) {
          const id = field["id"];
          if (typeof id === "string") catalogFieldIds.add(id);
        }
      }
      if (customization && catalogFieldIds.size > 0) {
        const renderTargets = objects(item.document["renderTargets"]);
        const mappedFieldIds = new Set(
          renderTargets.flatMap((target) =>
            objects(target["fieldMappings"])
              .map((mapping) => mapping["fieldId"])
              .filter((id): id is string => typeof id === "string"),
          ),
        );
        const hasWildcard = mappedFieldIds.has("*");
        const unmapped = hasWildcard
          ? []
          : [...catalogFieldIds].filter((id) => !mappedFieldIds.has(id));
        if (unmapped.length) {
          failures.push(
            `${item.path} metadata render targets omit catalog fields ${unmapped.join(", ")}`,
          );
        }
        for (const mode of ["simple", "advanced"] as const) {
          const modeDocument = isObject(customization[mode])
            ? customization[mode]
            : undefined;
          const modeFields = new Set(
            modeDocument ? stringArray(modeDocument["fields"]) : [],
          );
          const unknown = [...modeFields].filter(
            (id) => !catalogFieldIds.has(id),
          );
          if (unknown.length) {
            failures.push(
              `${item.path} ${mode} customization references fields outside its catalogs ${unknown.join(", ")}`,
            );
          }
          const missing = [...catalogFieldIds].filter((id) => {
            const catalog = catalogPaths
              .map((catalogPath) =>
                documents.get(resolve(repositoryRoot, catalogPath)),
              )
              .find(
                (document) =>
                  isObject(document) &&
                  objects(document["fields"]).some(
                    (field) => field["id"] === id,
                  ),
              );
            const field =
              catalog && isObject(catalog)
                ? objects(catalog["fields"]).find((value) => value["id"] === id)
                : undefined;
            return (
              isObject(field) &&
              field["modes"] instanceof Array &&
              field["modes"].includes(mode) &&
              !modeFields.has(id)
            );
          });
          if (missing.length) {
            failures.push(
              `${item.path} ${mode} customization omits catalog fields ${missing.join(", ")}`,
            );
          }
        }
      }
      for (const file of objects(item.document["files"])) {
        const source = file["source"];
        if (typeof source !== "string") continue;
        try {
          await stat(resolve(repositoryRoot, source));
        } catch {
          failures.push(
            `${item.path} references missing template source ${source}`,
          );
        }
      }
    }
  }
  return failures;
}

export async function validateFiles(
  paths: readonly string[],
): Promise<string[]> {
  const ajv = await createSchemaRegistry();
  const failures: string[] = [];
  const documents: LoadedDocument[] = [];
  for (const path of paths) {
    const document = JSON.parse(await readFile(path, "utf8")) as unknown;
    documents.push({ path, document });
    failures.push(...documentFailures(ajv, path, document));
  }
  failures.push(...(await catalogIntegrityFailures(ajv, documents)));
  failures.push(...(await phase4IntegrityFailures(documents)));
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
      ...[
        ...sourceDefinitionPolicyFailures(document as SourceDefinition),
        ...sourceAdapterFailures(document as SourceDefinition),
      ].map((failure) => `${path} ${failure}`),
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
