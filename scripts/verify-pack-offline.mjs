import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(
  process.cwd(),
  process.argv.includes("--dir")
    ? process.argv[process.argv.indexOf("--dir") + 1]
    : ".",
);

function fail(message) {
  throw new Error(`offline pack verification failed: ${message}`);
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

function canonical(value) {
  return `${JSON.stringify(normalize(value), null, 2)}\n`;
}

async function bytes(name) {
  return readFile(join(root, name));
}

async function json(name) {
  return JSON.parse(await bytes(name));
}

const requireReleaseEvidence = process.argv.includes(
  "--require-release-evidence",
);

function digest(value, algorithm) {
  return createHash(algorithm).update(value).digest("hex");
}

function parseChecksum(value, expectedName, expectedLength) {
  const match = value
    .toString("utf8")
    .trim()
    .match(/^([a-f0-9]+) {2}(.+)$/u);
  if (
    !match ||
    match[2] !== expectedName ||
    match[1].length !== expectedLength
  ) {
    fail(`invalid ${expectedName} checksum file`);
  }
  return match[1];
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(value) {
  let result = 0xffffffff;
  for (const byte of value) {
    result = (result >>> 8) ^ (crcTable[(result ^ byte) & 0xff] ?? 0);
  }
  return (result ^ 0xffffffff) >>> 0;
}

function safeZipPath(name) {
  if (
    name.length === 0 ||
    name.includes("\\") ||
    name.startsWith("/") ||
    name.includes("\u0000") ||
    name
      .split("/")
      .some((part) => part === "" || part === "." || part === "..") ||
    name
      .split("/")
      .some(
        (part) =>
          /[ .]$/u.test(part) ||
          /^(?:con|prn|aux|nul|clock\$|com[0-9]|lpt[0-9])(?:\..*)?$/iu.test(
            part,
          ),
      ) ||
    [...name].some((character) => character < " " || character === "\u007f")
  ) {
    fail(`unsafe zip path ${name}`);
  }
}

function readZip(buffer) {
  if (buffer.length > 512 * 1024 * 1024) fail("zip exceeds archive bounds");
  let end = -1;
  const minimumEnd = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minimumEnd; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) fail("zip end record is missing");
  if (end + 22 !== buffer.length) fail("zip has trailing data");
  if (buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0)
    fail("zip uses unsupported multi disk layout");
  const count = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if (count === 0 || count > 50000) fail("zip entry count is outside bounds");
  if (centralOffset + centralSize !== end)
    fail("zip central directory bounds are invalid");
  const entries = new Map();
  let cursor = centralOffset;
  let totalBytes = 0;
  const ranges = [];
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > end) fail("zip central header is truncated");
    if (buffer.readUInt32LE(cursor) !== 0x02014b50)
      fail("zip central header is invalid");
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const centralEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (centralEnd > end) fail("zip central entry is truncated");
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    safeZipPath(name);
    if (
      flags !== 0x0800 ||
      method !== 0 ||
      compressedSize !== uncompressedSize ||
      entries.has(name) ||
      localOffset >= centralOffset
    )
      fail(`unsafe zip entry ${name}`);
    if (
      localOffset + 30 > centralOffset ||
      buffer.readUInt32LE(localOffset) !== 0x04034b50
    )
      fail(`missing local header ${name}`);
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localCrc = buffer.readUInt32LE(localOffset + 14);
    const localCompressedSize = buffer.readUInt32LE(localOffset + 18);
    const localUncompressedSize = buffer.readUInt32LE(localOffset + 22);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const localName = buffer.toString(
      "utf8",
      localOffset + 30,
      localOffset + 30 + localNameLength,
    );
    if (
      localFlags !== flags ||
      localMethod !== method ||
      localName !== name ||
      localCrc !== crc ||
      localCompressedSize !== compressedSize ||
      localUncompressedSize !== uncompressedSize
    )
      fail(`zip local and central headers disagree for ${name}`);
    const contentStart = localOffset + 30 + localNameLength + localExtraLength;
    const contentEnd = contentStart + compressedSize;
    if (contentStart < 0 || contentEnd > centralOffset)
      fail(`zip entry exceeds local data bounds ${name}`);
    const content = buffer.subarray(contentStart, contentEnd);
    if (content.length !== compressedSize) fail(`truncated zip entry ${name}`);
    if (crc32(content) !== crc) fail(`zip crc mismatch for ${name}`);
    totalBytes += content.length;
    if (totalBytes > 512 * 1024 * 1024) fail("zip content exceeds bounds");
    ranges.push([localOffset, contentEnd]);
    entries.set(name, content);
    cursor = centralEnd;
  }
  ranges.sort(([left], [right]) => left - right);
  for (let index = 1; index < ranges.length; index += 1) {
    if ((ranges[index - 1]?.[1] ?? 0) > (ranges[index]?.[0] ?? 0))
      fail("zip local entries overlap");
  }
  if (cursor !== end) fail("zip central directory size mismatch");
  return entries;
}

function verifyProfile(entries, profilePath) {
  const profile = JSON.parse(
    entries.get(profilePath)?.toString("utf8") ?? "null",
  );
  if (!profile || typeof profile !== "object") fail(`missing ${profilePath}`);
  const catalog = profile.catalog;
  if (!catalog || typeof catalog.indexPath !== "string")
    fail(`${profilePath} has no catalog index`);
  const platformIndex = JSON.parse(
    entries.get(catalog.indexPath)?.toString("utf8") ?? "null",
  );
  if (!platformIndex || !Array.isArray(platformIndex.shards))
    fail(`missing ${catalog.indexPath}`);
  const indexBytes = entries.get(catalog.indexPath);
  if (!indexBytes || digest(indexBytes, "sha256") !== catalog.indexSha256)
    fail(`${profilePath} catalog index digest mismatch`);
  for (const selector of catalog.selectors ?? []) {
    for (const key of selector.keys?.values ?? []) {
      const shard = platformIndex.shards.find(
        (candidate) => candidate.key === key,
      );
      if (!shard) fail(`${profilePath} selector has no shard for ${key}`);
      const shardBytes = entries.get(shard.path);
      if (!shardBytes || digest(shardBytes, "sha256") !== shard.sha256)
        fail(`${profilePath} shard digest mismatch for ${key}`);
      const shardDocument = JSON.parse(shardBytes.toString("utf8"));
      if (!shardDocument || !Array.isArray(shardDocument.components))
        fail(`missing ${shard.path}`);
      for (const component of selector.components ?? []) {
        for (const version of component.versions ?? []) {
          const match = shardDocument.components.find(
            (candidate) =>
              candidate.coordinate === version || candidate.version === version,
          );
          if (!match)
            fail(
              `${profilePath} tuple ${version} is absent from ${shard.path}`,
            );
          if (
            typeof component.coordinatePrefix === "string" &&
            !String(match.coordinate).startsWith(component.coordinatePrefix)
          )
            fail(
              `${profilePath} tuple ${version} has an unexpected coordinate`,
            );
        }
      }
    }
  }
}

const archive = await bytes("mcgen-template-pack.zip");
const manifest = await json("pack-manifest.json");
const sourceManifest = await json("source-commit-manifest.json");
const summary = await json("verification-summary.json");
const sbom = await json("spdx-sbom.json");
const { createSchemaRegistry, validateWithSchema } =
  await import("../dist/schema-registry.js");
const registry = await createSchemaRegistry();
function validateDocument(name, value) {
  const result = validateWithSchema(registry, value);
  if (!result.valid) fail(`${name} does not satisfy its schema`);
}
validateDocument("pack manifest", manifest);
validateDocument("source commit manifest", sourceManifest);
validateDocument("verification summary", summary);
validateDocument("spdx sbom", sbom);
const sha256 = digest(archive, "sha256");
const sha512 = digest(archive, "sha512");
if (
  sha256 !==
  parseChecksum(
    await bytes("mcgen-template-pack.zip.sha256"),
    "mcgen-template-pack.zip",
    64,
  )
)
  fail("sha256 mismatch");
if (
  sha512 !==
  parseChecksum(
    await bytes("mcgen-template-pack.zip.sha512"),
    "mcgen-template-pack.zip",
    128,
  )
)
  fail("sha512 mismatch");
if (
  summary.status !== "verified" ||
  summary.packVersion !== manifest.packVersion ||
  summary.sourceCommit !== manifest.sourceCommit ||
  summary.archive?.sha256 !== sha256 ||
  summary.archive?.sha512 !== sha512 ||
  summary.archive?.bytes !== archive.length
)
  fail("verification summary does not match archive");
if (
  sourceManifest.sourceCommit !== manifest.sourceCommit ||
  sourceManifest.packVersion !== manifest.packVersion
)
  fail("source manifest identity mismatch");
if (
  sourceManifest.packManifestSha256 !==
  digest(Buffer.from(canonical(manifest)), "sha256")
)
  fail("pack manifest digest mismatch");
if (canonical(sourceManifest.files) !== canonical(manifest.files))
  fail("source commit manifest inventory mismatch");
if (
  sbom.packages?.[0]?.versionInfo !== manifest.packVersion ||
  sbom.files?.length !== manifest.files.length + 1
)
  fail("sbom inventory mismatch");
const expectedSbomFiles = new Map([
  ["pack-manifest.json", digest(Buffer.from(canonical(manifest)), "sha256")],
  ...manifest.files.map((file) => [file.path, file.sha256]),
]);
const actualSbomFiles = new Map(
  (sbom.files ?? []).map((file) => [
    file.fileName,
    file.checksums?.[0]?.checksum,
  ]),
);
if (actualSbomFiles.size !== expectedSbomFiles.size)
  fail("sbom file inventory count mismatch");
for (const [path, expectedDigest] of expectedSbomFiles) {
  if (actualSbomFiles.get(path) !== expectedDigest)
    fail(`sbom digest mismatch for ${path}`);
}
const entries = readZip(archive);
const expected = new Map(
  manifest.files.map((file) => [file.path, file.sha256]),
);
if (
  expected.size !== manifest.files.length ||
  expected.has("pack-manifest.json")
)
  fail("manifest contains duplicate or reserved paths");
for (const path of expected.keys()) safeZipPath(path);
expected.set(
  "pack-manifest.json",
  digest(Buffer.from(canonical(manifest)), "sha256"),
);
if (entries.size !== expected.size) fail("archive entry count mismatch");
for (const [path, expectedDigest] of expected) {
  const content = entries.get(path);
  if (!content || digest(content, "sha256") !== expectedDigest)
    fail(`archive digest mismatch for ${path}`);
}
verifyProfile(entries, "profiles/spigot-modern.json");
verifyProfile(entries, "profiles/spigot-legacy.json");
if (requireReleaseEvidence) {
  const coverage = await json("coverage.json");
  const rollback = await json("rollback-test.json");
  validateDocument("release coverage", coverage);
  validateDocument("rollback evidence", rollback);
  const releaseNotes = (await bytes("release-notes.md")).toString("utf8");
  if (!releaseNotes.trim()) fail("release notes are empty");
  if (
    coverage.$schema !== "urn:mcgen:verification:release-coverage:1" ||
    coverage.schemaVersion !== 1 ||
    coverage.packVersion !== manifest.packVersion ||
    coverage.sourceCommit !== manifest.sourceCommit ||
    coverage.coverage?.catalogSnapshotId !== manifest.catalogSnapshot ||
    coverage.packCoveragePath !== "verification/phase5/coverage.json" ||
    coverage.packCoverageSha256 !==
      manifest.files.find(
        (file) => file.path === "verification/phase5/coverage.json",
      )?.sha256 ||
    coverage.coverageDigest !==
      digest(Buffer.from(canonical(coverage.coverage)), "sha256") ||
    coverage.coverage?.$schema !== "urn:mcgen:schema:coverage-summary:1"
  )
    fail("coverage evidence identity mismatch");
  const archivedCoverage = entries.get(coverage.packCoveragePath);
  if (!archivedCoverage) fail("archived coverage evidence is missing");
  if (digest(archivedCoverage, "sha256") !== coverage.packCoverageSha256)
    fail("archived coverage digest mismatch");
  if (
    coverage.coverageDigest !== digest(archivedCoverage, "sha256") ||
    canonical(JSON.parse(archivedCoverage.toString("utf8"))) !==
      canonical(coverage.coverage)
  )
    fail("release coverage does not match archived coverage");
  const { digest: summaryDigest, ...summaryWithoutDigest } = coverage.coverage;
  if (
    summaryDigest !==
    digest(Buffer.from(canonical(summaryWithoutDigest)), "sha256")
  )
    fail("coverage summary digest is invalid");
  if (
    rollback.status !== "passed" ||
    rollback.packVersion !== manifest.packVersion ||
    rollback.sourceCommit !== manifest.sourceCommit ||
    rollback.originalArchiveSha256 !== sha256
  )
    fail("rollback evidence identity mismatch");
}
process.stdout.write(
  `offline pack verified ${manifest.packVersion} ${manifest.sourceCommit} ${sha256}\n`,
);
