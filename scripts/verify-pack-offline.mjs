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

function readZip(buffer) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) fail("zip end record is missing");
  const count = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50)
      fail("zip central header is invalid");
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    if (flags !== 0x0800 || method !== 0 || entries.has(name))
      fail(`unsafe zip entry ${name}`);
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50)
      fail(`missing local header ${name}`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const contentStart = localOffset + 30 + localNameLength + localExtraLength;
    const content = buffer.subarray(
      contentStart,
      contentStart + compressedSize,
    );
    if (content.length !== compressedSize) fail(`truncated zip entry ${name}`);
    entries.set(name, content);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor - centralOffset !== centralSize)
    fail("zip central directory size mismatch");
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
  for (const selector of catalog.selectors ?? []) {
    const shard = platformIndex.shards.find(
      (candidate) => candidate.key === selector.keys?.values?.[0],
    );
    if (!shard) fail(`${profilePath} selector has no shard`);
    const shardDocument = JSON.parse(
      entries.get(shard.path)?.toString("utf8") ?? "null",
    );
    if (!shardDocument || !Array.isArray(shardDocument.components))
      fail(`missing ${shard.path}`);
    for (const component of selector.components ?? []) {
      for (const version of component.versions ?? []) {
        if (
          !shardDocument.components.some(
            (candidate) =>
              candidate.coordinate === version || candidate.version === version,
          )
        ) {
          fail(`${profilePath} tuple ${version} is absent from ${shard.path}`);
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
  summary.archive?.sha256 !== sha256 ||
  summary.archive?.sha512 !== sha512
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
if (
  sbom.packages?.[0]?.versionInfo !== manifest.packVersion ||
  sbom.files?.length !== manifest.files.length + 1
)
  fail("sbom inventory mismatch");
const entries = readZip(archive);
const expected = new Map(
  manifest.files.map((file) => [file.path, file.sha256]),
);
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
process.stdout.write(
  `offline pack verified ${manifest.packVersion} ${manifest.sourceCommit} ${sha256}\n`,
);
