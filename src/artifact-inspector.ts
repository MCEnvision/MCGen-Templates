import { extname } from "node:path";
import { inflateRawSync } from "node:zlib";
import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import { validatePng } from "./png.js";
import type {
  ArtifactExpectation,
  ArtifactInspection,
} from "./phase5-contracts.js";

export type ArtifactEntry = {
  path: string;
  content: Uint8Array;
  directory?: boolean;
};

function uint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function uint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 22 - 65_535);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1)
    if (uint32(bytes, offset) === 0x06054b50) return offset;
  return -1;
}

export function readZipEntries(bytes: Uint8Array): ArtifactEntry[] {
  const end = findEndOfCentralDirectory(bytes);
  if (end < 0) throw new Error("artifact is not a zip archive");
  const entriesCount = uint16(bytes, end + 10);
  const centralSize = uint32(bytes, end + 12);
  const centralOffset = uint32(bytes, end + 16);
  if (centralOffset + centralSize > end)
    throw new Error("zip central directory exceeds artifact");
  const entries: ArtifactEntry[] = [];
  let totalUncompressed = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entriesCount; index += 1) {
    if (uint32(bytes, cursor) !== 0x02014b50)
      throw new Error("zip central directory entry is invalid");
    const flags = uint16(bytes, cursor + 8);
    const method = uint16(bytes, cursor + 10);
    const crc = uint32(bytes, cursor + 16);
    const compressedSize = uint32(bytes, cursor + 20);
    const uncompressedSize = uint32(bytes, cursor + 24);
    const nameLength = uint16(bytes, cursor + 28);
    const extraLength = uint16(bytes, cursor + 30);
    const commentLength = uint16(bytes, cursor + 32);
    const localOffset = uint32(bytes, cursor + 42);
    const name = new TextDecoder().decode(
      bytes.slice(cursor + 46, cursor + 46 + nameLength),
    );
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > end || localOffset + 30 > bytes.length)
      throw new Error("zip entry exceeds artifact");
    if (uint32(bytes, localOffset) !== 0x04034b50)
      throw new Error(`zip local entry header is invalid ${name}`);
    if ((flags & 0x1) !== 0) throw new Error(`encrypted zip entry ${name}`);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff)
      throw new Error(`zip64 entry is not supported ${name}`);
    if (uncompressedSize > 64 * 1024 * 1024)
      throw new Error(`zip entry is too large ${name}`);
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > 256 * 1024 * 1024)
      throw new Error("zip archive exceeds total uncompressed size limit");
    const localNameLength = uint16(bytes, localOffset + 26);
    const localExtraLength = uint16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length)
      throw new Error(`zip entry data exceeds artifact ${name}`);
    const compressed = bytes.slice(dataStart, dataEnd);
    let content: Uint8Array;
    try {
      content =
        method === 0
          ? new Uint8Array(compressed)
          : method === 8
            ? new Uint8Array(inflateRawSync(compressed))
            : (() => {
                throw new Error(`unsupported zip compression method ${method}`);
              })();
    } catch (error) {
      throw new Error(
        `zip entry cannot be decoded ${name}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    if (content.byteLength !== uncompressedSize || crc32(content) !== crc)
      throw new Error(`zip entry integrity check failed ${name}`);
    entries.push({
      path: name,
      content,
      directory: name.endsWith("/"),
    });
    cursor = next;
  }
  return entries;
}

function unsafePath(path: string): boolean {
  return (
    path.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(path) ||
    path.includes("\0") ||
    path.includes("\\") ||
    path
      .split("/")
      .some((part) => part === ".." || part === "." || part === "") ||
    path.startsWith(".git/") ||
    path.startsWith(".gradle/") ||
    path.startsWith("build/") ||
    path.startsWith("logs/") ||
    path.endsWith(".log")
  );
}

function pathMatches(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^${escaped.replaceAll("*", ".*")}$`, "u").test(path);
}

function flatten(
  value: unknown,
  prefix = "",
  output: Record<string, string> = {},
): Record<string, string> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
    return output;
  }
  if (value === undefined) return output;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    output[prefix] = String(value);
  } else {
    output[prefix] = canonicalJson(value).trim();
  }
  return output;
}

function parseMetadata(
  path: string,
  content: Uint8Array,
): {
  format: "json" | "properties" | "text" | "unknown";
  valid: boolean;
  values: Record<string, string>;
} {
  const text = new TextDecoder().decode(content);
  if (extname(path) === ".json") {
    try {
      return { format: "json", valid: true, values: flatten(JSON.parse(text)) };
    } catch {
      return { format: "json", valid: false, values: {} };
    }
  }
  if (
    extname(path) === ".properties" ||
    extname(path) === ".yml" ||
    extname(path) === ".yaml"
  ) {
    const values: Record<string, string> = {};
    for (const line of text.split(/\r?\n/u)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.includes("=")
        ? trimmed.indexOf("=")
        : trimmed.indexOf(":");
      if (separator <= 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value =
        rawValue.length >= 2 &&
        ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
          (rawValue.startsWith("'") && rawValue.endsWith("'")))
          ? rawValue.slice(1, -1)
          : rawValue;
      values[key] = value;
    }
    return { format: "properties", valid: true, values };
  }
  if (text.includes("\u0000"))
    return { format: "unknown", valid: false, values: {} };
  return { format: "text", valid: true, values: { text } };
}

function hasSecret(value: Uint8Array): boolean {
  const text = new TextDecoder().decode(value);
  return /(?:github_pat_|ghp_|gho_|ghs_|aws_secret_access_key\s*=|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu.test(
    text,
  );
}

export function inspectArtifactEntries(
  artifactPath: string,
  artifactBytes: Uint8Array,
  entries: readonly ArtifactEntry[],
  expectation: ArtifactExpectation,
): ArtifactInspection {
  const failures: string[] = [];
  const warnings: string[] = [];
  if (
    !artifactPath ||
    artifactPath.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(artifactPath) ||
    artifactPath.includes("\\") ||
    artifactPath.split("/").some((part) => part === ".." || part === "")
  )
    failures.push("artifact path is not repository relative");
  if (
    expectation.maxEntries !== undefined &&
    entries.length > expectation.maxEntries
  )
    failures.push(`artifact has more than ${expectation.maxEntries} entries`);
  const sortedEntries = entries.filter(
    (entry) => !entry.directory && !entry.path.endsWith("/"),
  );
  sortedEntries.sort((left, right) => left.path.localeCompare(right.path));
  const seen = new Set<string>();
  for (const entry of sortedEntries) {
    if (seen.has(entry.path))
      failures.push(`artifact entry is duplicated ${entry.path}`);
    seen.add(entry.path);
    if (unsafePath(entry.path))
      failures.push(`artifact entry path is unsafe ${entry.path}`);
    if (hasSecret(entry.content))
      failures.push(`artifact entry contains a secret ${entry.path}`);
    if (entry.content.byteLength > 16 * 1024 * 1024)
      failures.push(`artifact entry is too large ${entry.path}`);
  }
  if (!artifactPath.endsWith(expectation.expectedExtension))
    failures.push(`artifact extension is not ${expectation.expectedExtension}`);
  for (const pattern of expectation.patterns) {
    if (!pathMatches(pattern, artifactPath))
      failures.push(`artifact path does not match ${pattern}`);
  }
  if (expectation.expectedClassifier) {
    const fileName = artifactPath.split(/[\\/]/u).at(-1) ?? artifactPath;
    if (!fileName.includes(`-${expectation.expectedClassifier}.`))
      failures.push(
        `artifact classifier is not ${expectation.expectedClassifier}`,
      );
  }
  const byPath = new Map(
    sortedEntries.map((entry) => [entry.path, entry.content]),
  );
  for (const path of expectation.requiredEntries) {
    if (!byPath.has(path))
      failures.push(`required artifact entry is missing ${path}`);
  }
  const metadata = expectation.metadataPaths.map((path) => {
    const content = byPath.get(path);
    if (!content) {
      failures.push(`metadata path is missing ${path}`);
      return { path, format: "unknown" as const, valid: false, values: {} };
    }
    const parsed = parseMetadata(path, content);
    if (!parsed.valid) failures.push(`metadata is invalid ${path}`);
    return { path, ...parsed };
  });
  const metadataValues: Record<string, string> = {};
  for (const item of metadata) Object.assign(metadataValues, item.values);
  if (expectation.projectIdentity) {
    for (const [field, value] of [
      ["id", expectation.projectIdentity.id],
      ["version", expectation.projectIdentity.version],
    ] as const) {
      const present = Object.values(metadataValues).includes(value);
      if (!present)
        failures.push(`project ${field} is not present in artifact metadata`);
    }
    if (
      expectation.projectIdentity.name &&
      !Object.values(metadataValues).includes(expectation.projectIdentity.name)
    )
      warnings.push("project name is not present in artifact metadata");
  }
  for (const [path, expected] of Object.entries(
    expectation.metadataFields ?? {},
  )) {
    if (metadataValues[path] !== expected)
      failures.push(`artifact metadata field does not match ${path}`);
  }
  if (expectation.publicationCoordinates) {
    for (const value of Object.values(expectation.publicationCoordinates)) {
      if (!Object.values(metadataValues).includes(value))
        failures.push(
          `publication coordinate is not present in artifact metadata ${value}`,
        );
    }
  }
  for (const className of expectation.entrypointClasses) {
    const path = `${className.replaceAll(".", "/")}.class`;
    if (!byPath.has(path)) failures.push(`entrypoint class is missing ${path}`);
  }
  for (const namespace of expectation.resourceNamespaces) {
    if (
      !sortedEntries.some(
        (entry) =>
          entry.path.startsWith(`assets/${namespace}/`) ||
          entry.path.startsWith(`data/${namespace}/`),
      )
    )
      failures.push(`resource namespace is missing ${namespace}`);
  }
  for (const path of expectation.iconPaths) {
    const content = byPath.get(path);
    if (!content) {
      failures.push(`icon is missing ${path}`);
      continue;
    }
    try {
      validatePng(content);
    } catch {
      failures.push(`icon is not a valid png ${path}`);
    }
  }
  for (const reference of expectation.iconReferences ?? []) {
    const referenced = metadataValues[reference.metadataPath];
    if (referenced !== reference.iconPath)
      failures.push(
        `artifact icon reference does not match ${reference.metadataPath}`,
      );
  }
  return {
    status: failures.length ? "failed" : "passed",
    path: artifactPath,
    sha256: sha256(artifactBytes),
    bytes: artifactBytes.byteLength,
    entries: sortedEntries.map((entry) => entry.path),
    metadata,
    failures,
    warnings,
  };
}

export function inspectArtifact(
  artifactPath: string,
  artifactBytes: Uint8Array,
  expectation: ArtifactExpectation,
): ArtifactInspection {
  let entries: ArtifactEntry[];
  try {
    entries = readZipEntries(artifactBytes);
  } catch (error) {
    return {
      status: "failed",
      path: artifactPath,
      sha256: sha256(artifactBytes),
      bytes: artifactBytes.byteLength,
      entries: [],
      metadata: [],
      failures: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
  return inspectArtifactEntries(
    artifactPath,
    artifactBytes,
    entries,
    expectation,
  );
}
