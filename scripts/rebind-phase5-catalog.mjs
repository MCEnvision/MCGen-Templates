import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const root = process.cwd();
const fromSnapshot = argument("--from");
const toSnapshot = argument("--to");
if (!fromSnapshot || !toSnapshot)
  throw new Error("rebind phase 5 catalog requires --from and --to");

function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--")) return undefined;
  return value;
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compare(left, right))
        .map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}

function canonical(value) {
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeCanonical(path, value) {
  await writeFile(path, canonical(value), "utf8");
}

const oldCatalogRoot = resolve(root, "catalog", fromSnapshot);
const newCatalogRoot = resolve(root, "catalog", toSnapshot);
const newPlatformIndexes = new Map();
for (const platform of await readdir(join(newCatalogRoot, "platforms"))) {
  const path = join(newCatalogRoot, "platforms", platform, "index.json");
  const index = await readJson(path);
  newPlatformIndexes.set(platform, {
    path: `catalog/${toSnapshot}/platforms/${platform}/index.json`,
    sha256: digest(canonical(index)),
    index,
  });
}

const profileDirectory = resolve(root, "profiles");
const profileNames = (await readdir(profileDirectory))
  .filter((name) => name.endsWith(".json") && name !== "index.json")
  .sort(compare);
const profileMap = new Map();
for (const name of profileNames) {
  const path = join(profileDirectory, name);
  const profile = await readJson(path);
  const platform = profile.platform;
  const index = newPlatformIndexes.get(platform);
  if (!index) throw new Error(`new catalog is missing platform ${platform}`);
  const oldIndexPath = profile.catalog?.indexPath;
  if (
    typeof oldIndexPath !== "string" ||
    !oldIndexPath.startsWith(`catalog/${fromSnapshot}/`)
  )
    throw new Error(`${name} is not bound to ${fromSnapshot}`);
  const updated = structuredClone(profile);
  updated.revision += 1;
  updated.catalog.snapshotId = toSnapshot;
  updated.catalog.indexPath = index.path;
  updated.catalog.indexSha256 = index.sha256;
  await writeCanonical(path, updated);
  profileMap.set(updated.id, {
    ...updated,
    digest: digest(canonical(updated)),
  });
}

const profileIndexPath = join(profileDirectory, "index.json");
const profileIndex = await readJson(profileIndexPath);
profileIndex.catalogSnapshot = toSnapshot;
profileIndex.profiles = profileIndex.profiles
  .map((entry) => {
    const profile = profileMap.get(entry.id);
    if (!profile) throw new Error(`profile index references missing ${entry.id}`);
    return { ...entry, sha256: profile.digest };
  })
  .sort((left, right) => compare(left.id, right.id));
await writeCanonical(profileIndexPath, profileIndex);

const matrixPath = resolve(root, "verification/phase5/matrix.json");
const matrix = await readJson(matrixPath);
const oldToNew = new Map();
const tuples = matrix.tuples.map((tuple) => {
  const profile = profileMap.get(tuple.identity.profileId);
  if (!profile) throw new Error(`matrix references missing profile ${tuple.identity.profileId}`);
  const platformIndex = newPlatformIndexes.get(profile.platform);
  const shard = platformIndex.index.shards.find(
    (candidate) => candidate.key === tuple.identity.catalogKey,
  );
  if (!shard)
    throw new Error(
      `new catalog is missing ${profile.platform} shard ${tuple.identity.catalogKey}`,
    );
  const identity = structuredClone(tuple.identity);
  identity.catalogSnapshotId = toSnapshot;
  identity.profileRevision = profile.revision;
  identity.contentDigests.profile = profile.digest;
  identity.contentDigests.catalog = shard.sha256;
  const updated = {
    ...tuple,
    id: digest(canonical(identity)),
    identity,
    profileRevision: profile.revision,
  };
  oldToNew.set(
    `${tuple.identity.profileId}\u0000${tuple.identity.fixtureId}`,
    updated,
  );
  return updated;
});
const sortedTuples = tuples.sort((left, right) => compare(left.id, right.id));
const shards = Array.from({ length: matrix.shardCount }, (_, index) => {
  const shardTuples = sortedTuples.filter(
    (tuple) => Number.parseInt(tuple.id.slice(0, 8), 16) % matrix.shardCount === index,
  );
  return {
    index,
    tuples: shardTuples,
    digest: digest(canonical(shardTuples)),
  };
});
const withoutDigest = {
  $schema: matrix.$schema,
  schemaVersion: matrix.schemaVersion,
  kind: matrix.kind,
  shardCount: matrix.shardCount,
  tuples: sortedTuples,
  shards,
};
const updatedMatrix = { ...withoutDigest, digest: digest(canonical(withoutDigest)) };
await writeCanonical(matrixPath, updatedMatrix);

const executionDirectory = resolve(root, "verification/phase5/executions");
for (const name of (await readdir(executionDirectory)).filter((value) => value.endsWith(".json")).sort(compare)) {
  const path = join(executionDirectory, name);
  const execution = await readJson(path);
  const oldIdentity = execution.tuple?.identity;
  const tuple = oldToNew.get(
    `${oldIdentity?.profileId}\u0000${oldIdentity?.fixtureId}`,
  );
  if (!tuple) throw new Error(`${name} execution is not in the matrix`);
  const executionTuple = {
    id: tuple.id,
    status: "discovered",
    blockers: [...tuple.blockers],
    identity: tuple.identity,
  };
  const updated = {
    ...execution,
    tuple: executionTuple,
    fixture: { ...execution.fixture, tuple: tuple.identity },
  };
  await writeCanonical(path, updated);
}

const coveragePath = resolve(root, "verification/phase5/coverage.json");
const coverage = await readJson(coveragePath);
coverage.catalogSnapshotId = toSnapshot;
coverage.matrixDigest = updatedMatrix.digest;
coverage.total = sortedTuples.length;
coverage.counts = {
  verified: 0,
  "legacy-verified": 0,
  discovered: sortedTuples.length,
  blocked: 0,
  failed: 0,
  skipped: 0,
  queued: 0,
};
coverage.blockers = sortedTuples.map((tuple) => ({
  tupleId: tuple.id,
  status: tuple.status,
  reasons: tuple.blockers.length ? tuple.blockers : ["tuple requires fresh evidence after catalog rebind"],
}));
coverage.evidenceDigests = [];
coverage.byFamily = [];
coverage.digest = digest(
  canonical({
    $schema: coverage.$schema,
    schemaVersion: coverage.schemaVersion,
    kind: coverage.kind,
    catalogSnapshotId: coverage.catalogSnapshotId,
    generatedAt: coverage.generatedAt,
    matrixDigest: coverage.matrixDigest,
    total: coverage.total,
    counts: coverage.counts,
    byFamily: coverage.byFamily,
    blockers: coverage.blockers,
    evidenceDigests: coverage.evidenceDigests,
  }),
);
await writeCanonical(coveragePath, coverage);
console.log(`rebound ${sortedTuples.length} tuples from ${fromSnapshot} to ${toSnapshot}`);
