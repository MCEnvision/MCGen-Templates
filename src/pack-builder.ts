import { compareText, canonicalJson } from "./canonical-json.js";
import { sha256, sha512 } from "./digest.js";
import { readZipEntries } from "./artifact-inspector.js";

export type PackFile = {
  path: string;
  content: Uint8Array | string;
};

export type PackRevision = {
  id: string;
  revision: number;
};

export type PackManifestFile = {
  path: string;
  sha256: string;
};

export type PackManifest = {
  $schema: "urn:mcgen:schema:pack-manifest:1";
  schemaVersion: 1;
  packVersion: string;
  sourceCommit: string;
  createdAt: string;
  schemas: PackManifestFile[];
  families: PackManifestFile[];
  profiles: PackManifestFile[];
  catalogs: PackManifestFile[];
  files: PackManifestFile[];
  sourceReferences: PackManifestFile[];
  fixtures: PackManifestFile[];
  evidence: PackManifestFile[];
  catalogSnapshot?: string;
  familyRevisions?: PackRevision[];
  profileRevisions?: PackRevision[];
};

export type PackBuildInput = {
  packVersion: string;
  sourceCommit: string;
  createdAt: string;
  files: readonly PackFile[];
  catalogSnapshot?: string;
  familyRevisions?: readonly PackRevision[];
  profileRevisions?: readonly PackRevision[];
};

export type PackBuild = {
  manifest: PackManifest;
  archive: Uint8Array;
  archiveSha256: string;
  archiveSha512: string;
  archiveBytes: number;
};

export type SpdxFile = {
  SPDXID: string;
  fileName: string;
  checksums: [{ algorithm: "SHA256"; checksum: string }];
  licenseConcluded: "NOASSERTION";
};

export type SpdxSbom = {
  $schema: "urn:mcgen:schema:spdx-sbom:1";
  SPDXID: "SPDXRef-DOCUMENT";
  spdxVersion: "SPDX-2.3";
  dataLicense: "CC0-1.0";
  name: string;
  documentNamespace: string;
  creationInfo: {
    created: string;
    creators: ["Tool: mcgen-template-pack"];
    licenseListVersion: "3.23";
  };
  packages: [
    {
      SPDXID: "SPDXRef-Package-MCGenTemplatePack";
      name: string;
      versionInfo: string;
      downloadLocation: "NOASSERTION";
      licenseConcluded: "NOASSERTION";
      licenseDeclared: "NOASSERTION";
      filesAnalyzed: true;
    },
  ];
  files: SpdxFile[];
  relationships: {
    spdxElementId: string;
    relationshipType: "DESCRIBES" | "CONTAINS";
    relatedSpdxElement: string;
  }[];
};

export type SourceCommitManifest = {
  $schema: "urn:mcgen:schema:source-commit-manifest:1";
  schemaVersion: 1;
  packVersion: string;
  sourceCommit: string;
  packManifestSha256: string;
  files: PackManifestFile[];
};

function contentBytes(content: Uint8Array | string): Uint8Array {
  return typeof content === "string"
    ? Buffer.from(content, "utf8")
    : Uint8Array.from(content);
}

function validatePackInput(input: PackBuildInput): void {
  if (
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u.test(input.packVersion)
  ) {
    throw new Error("pack version is not valid semantic version syntax");
  }
  if (!/^[a-f0-9]{40}$/u.test(input.sourceCommit)) {
    throw new Error("pack source commit must be a lowercase commit sha");
  }
  if (
    Number.isNaN(Date.parse(input.createdAt)) ||
    new Date(input.createdAt).toISOString() !== input.createdAt
  ) {
    throw new Error("pack createdAt must be a canonical ISO timestamp");
  }
  if (
    input.catalogSnapshot !== undefined &&
    (input.catalogSnapshot.length === 0 || input.catalogSnapshot.length > 128)
  ) {
    throw new Error("pack catalog snapshot is outside the supported bounds");
  }
}

function normalizePackPath(path: string): string {
  const allowed =
    path === "README.md" ||
    path === "pack-manifest.json" ||
    [
      "catalog/",
      "docs/architecture/",
      "docs/data/",
      "docs/release/",
      "docs/verification/",
      "fixtures/",
      "profiles/",
      "schemas/",
      "sources/definitions/",
      "sources/snapshots/",
      "templates/",
      "verification/phase5/evidence/",
    ].some((prefix) => path.startsWith(prefix));
  const approvedPhase5Document = [
    "verification/phase5/audit.json",
    "verification/phase5/coverage.json",
    "verification/phase5/matrix.json",
  ].includes(path);
  const approved = allowed || approvedPhase5Document;
  if (!approved) {
    throw new Error(`pack path is outside the allowlist: ${path}`);
  }
  if (
    path.length === 0 ||
    path.length > 512 ||
    path.includes("\\") ||
    path.includes("\u0000") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path) ||
    path.normalize("NFC") !== path ||
    /^(?:\.git|\.gradle|build|dist|logs|node_modules|verification\/phase6)(?:\/|$)/u.test(
      path,
    ) ||
    /(?:^|\/)(?:\.env|.*\.pem|.*\.key)$/u.test(path)
  ) {
    throw new Error(`pack path is not portable: ${path}`);
  }
  const parts = path.split("/");
  const protectedComponents = new Set([
    ".git",
    ".gradle",
    "build",
    "dist",
    "logs",
    "node_modules",
    "tmp",
    "cache",
  ]);
  const hasControlCharacter = (part: string): boolean => {
    for (const character of part) {
      if (character < " " || character === "\u007f") return true;
    }
    return false;
  };
  if (
    parts.length > 32 ||
    parts.some(
      (part) =>
        part.length === 0 ||
        part.length > 255 ||
        part === "." ||
        part === ".." ||
        protectedComponents.has(part.toLocaleLowerCase("en-US")) ||
        /[ .]$/u.test(part) ||
        /^(?:con|prn|aux|nul|clock\$|com[0-9]|lpt[0-9])(?:\..*)?$/iu.test(
          part,
        ) ||
        hasControlCharacter(part),
    )
  ) {
    throw new Error(`pack path contains protected or unsafe content: ${path}`);
  }
  if (/(?:^|\/)verification\/phase6(?:\/|$)/u.test(path)) {
    throw new Error(`pack path contains protected or unsafe content: ${path}`);
  }
  return path;
}

function normalizeFiles(files: readonly PackFile[]): PackFile[] {
  if (files.length === 0 || files.length > 50_000) {
    throw new Error("pack file count is outside the supported bounds");
  }
  const normalized = files.map((file) => ({
    path: normalizePackPath(file.path),
    content: contentBytes(file.content),
  }));
  const totalBytes = normalized.reduce(
    (total, file) => total + file.content.byteLength,
    0,
  );
  if (
    normalized.some((file) => file.content.byteLength > 32 * 1024 * 1024) ||
    totalBytes > 512 * 1024 * 1024
  ) {
    throw new Error("pack content exceeds the supported bounds");
  }
  normalized.sort((left, right) => compareText(left.path, right.path));
  for (let index = 1; index < normalized.length; index += 1) {
    if (
      normalized[index - 1]?.path === normalized[index]?.path ||
      normalized[index - 1]?.path.toLocaleLowerCase("en-US") ===
        normalized[index]?.path.toLocaleLowerCase("en-US")
    ) {
      throw new Error(
        `pack contains duplicate path ${normalized[index]?.path}`,
      );
    }
  }
  if (normalized.some((file) => file.path === "pack-manifest.json")) {
    throw new Error(
      "pack-manifest.json is reserved for the generated manifest",
    );
  }
  return normalized;
}

function digestFiles(files: readonly PackFile[]): PackManifestFile[] {
  return files.map((file) => ({
    path: file.path,
    sha256: sha256(file.content),
  }));
}

function revisionList(
  revisions: readonly PackRevision[] | undefined,
): PackRevision[] | undefined {
  if (!revisions) return undefined;
  for (const revision of revisions) {
    if (
      !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(revision.id) ||
      !Number.isInteger(revision.revision) ||
      revision.revision < 1
    ) {
      throw new Error(`pack revision is invalid for ${revision.id}`);
    }
  }
  const result = revisions.map((revision) => ({ ...revision }));
  result.sort(
    (left, right) =>
      compareText(left.id, right.id) || left.revision - right.revision,
  );
  for (let index = 1; index < result.length; index += 1) {
    if (result[index - 1]?.id === result[index]?.id) {
      throw new Error(`pack revision is duplicated for ${result[index]?.id}`);
    }
  }
  return result;
}

export function buildPackManifest(input: PackBuildInput): PackManifest {
  validatePackInput(input);
  if (
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u.test(input.packVersion)
  ) {
    throw new Error("pack version must use semantic version syntax");
  }
  if (!/^[a-f0-9]{40}$/u.test(input.sourceCommit)) {
    throw new Error("pack source commit must be a lowercase git commit sha");
  }
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(input.createdAt) ||
    Number.isNaN(Date.parse(input.createdAt))
  ) {
    throw new Error("pack createdAt must be a canonical UTC timestamp");
  }
  const files = normalizeFiles(input.files);
  const digests = digestFiles(files);
  const byPrefix = (prefix: string): PackManifestFile[] =>
    digests.filter((file) => file.path.startsWith(prefix));
  const manifest: PackManifest = {
    $schema: "urn:mcgen:schema:pack-manifest:1",
    schemaVersion: 1,
    packVersion: input.packVersion,
    sourceCommit: input.sourceCommit,
    createdAt: input.createdAt,
    schemas: byPrefix("schemas/"),
    families: byPrefix("templates/"),
    profiles: byPrefix("profiles/"),
    catalogs: byPrefix("catalog/"),
    files: digests,
    sourceReferences: digests.filter(
      (file) =>
        file.path.startsWith("sources/definitions/") ||
        file.path.startsWith("sources/snapshots/"),
    ),
    fixtures: byPrefix("fixtures/"),
    evidence: byPrefix("verification/"),
  };
  if (input.catalogSnapshot !== undefined) {
    manifest.catalogSnapshot = input.catalogSnapshot;
  }
  const familyRevisions = revisionList(input.familyRevisions);
  if (familyRevisions !== undefined) manifest.familyRevisions = familyRevisions;
  const profileRevisions = revisionList(input.profileRevisions);
  if (profileRevisions !== undefined)
    manifest.profileRevisions = profileRevisions;
  return manifest;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (value >>> 8) ^ (crcTable[(value ^ byte) & 0xff] ?? 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function append(parts: Uint8Array[], value: Uint8Array): void {
  parts.push(value);
}

function deterministicZip(files: readonly PackFile[]): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const content = contentBytes(file.content);
    if (name.length > 0xffff || content.length > 0xffffffff) {
      throw new Error(`pack entry is too large: ${file.path}`);
    }
    const checksum = crc32(content);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 33, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    append(local, localHeader);
    append(local, name);
    append(local, content);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 0x0314, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 33, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0x81a40000, true);
    centralView.setUint32(42, offset, true);
    append(central, centralHeader);
    append(central, name);
    offset += 30 + name.length + content.length;
  }
  const localBytes = Buffer.concat(local.map((part) => Buffer.from(part)));
  const centralBytes = Buffer.concat(central.map((part) => Buffer.from(part)));
  if (files.length > 0xffff || localBytes.length > 0xffffffff) {
    throw new Error("pack contains too many files or is too large");
  }
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralBytes.length, true);
  endView.setUint32(16, localBytes.length, true);
  return Uint8Array.from(
    Buffer.concat([localBytes, centralBytes, Buffer.from(end)]),
  );
}

export function validatePackArchive(
  archive: Uint8Array,
  expectedPaths: readonly string[],
): void {
  const actual = readZipEntries(archive)
    .map((entry) => entry.path)
    .sort(compareText);
  const expected = [...expectedPaths].sort(compareText);
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error("pack archive entries do not match the expected manifest");
  }
  if (new Set(actual).size !== actual.length) {
    throw new Error("pack archive contains duplicate entries");
  }
}

export function buildSpdxSbom(manifest: PackManifest): SpdxSbom {
  const files = [
    {
      SPDXID: `SPDXRef-File-${sha256("pack-manifest.json").slice(0, 16)}`,
      fileName: "pack-manifest.json",
      checksums: [
        {
          algorithm: "SHA256" as const,
          checksum: sha256(canonicalJson(manifest)),
        },
      ] as SpdxFile["checksums"],
      licenseConcluded: "NOASSERTION" as const,
    },
    ...manifest.files.map((file) => ({
      SPDXID: `SPDXRef-File-${sha256(file.path).slice(0, 16)}`,
      fileName: file.path,
      checksums: [
        { algorithm: "SHA256" as const, checksum: file.sha256 },
      ] as SpdxFile["checksums"],
      licenseConcluded: "NOASSERTION" as const,
    })),
  ];
  files.sort((left, right) => compareText(left.fileName, right.fileName));
  return {
    $schema: "urn:mcgen:schema:spdx-sbom:1",
    SPDXID: "SPDXRef-DOCUMENT",
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    name: `mcgen-template-pack-${manifest.packVersion}`,
    documentNamespace: `https://mcgen.enviouse.com/spdx/${manifest.sourceCommit}/${manifest.packVersion}`,
    creationInfo: {
      created: manifest.createdAt,
      creators: ["Tool: mcgen-template-pack"],
      licenseListVersion: "3.23",
    },
    packages: [
      {
        SPDXID: "SPDXRef-Package-MCGenTemplatePack",
        name: "mcgen-template-pack",
        versionInfo: manifest.packVersion,
        downloadLocation: "NOASSERTION",
        licenseConcluded: "NOASSERTION",
        licenseDeclared: "NOASSERTION",
        filesAnalyzed: true,
      },
    ],
    files,
    relationships: [
      {
        spdxElementId: "SPDXRef-DOCUMENT",
        relationshipType: "DESCRIBES",
        relatedSpdxElement: "SPDXRef-Package-MCGenTemplatePack",
      },
      ...files.map((file) => ({
        spdxElementId: "SPDXRef-Package-MCGenTemplatePack",
        relationshipType: "CONTAINS" as const,
        relatedSpdxElement: file.SPDXID,
      })),
    ],
  };
}

export function buildSourceCommitManifest(
  manifest: PackManifest,
): SourceCommitManifest {
  return {
    $schema: "urn:mcgen:schema:source-commit-manifest:1",
    schemaVersion: 1,
    packVersion: manifest.packVersion,
    sourceCommit: manifest.sourceCommit,
    packManifestSha256: sha256(canonicalJson(manifest)),
    files: manifest.files,
  };
}

export function verifyPackArchive(
  archive: Uint8Array,
  manifest: PackManifest,
): void {
  if (archive.byteLength > 512 * 1024 * 1024) {
    throw new Error("pack archive exceeds the supported bounds");
  }
  const expected = new Map(
    manifest.files.map((file) => [file.path, file.sha256]),
  );
  expected.set("pack-manifest.json", sha256(canonicalJson(manifest)));
  const seen = new Set<string>();
  let offset = 0;
  while (offset + 4 <= archive.byteLength) {
    const header = new DataView(archive.buffer, archive.byteOffset + offset);
    const signature = header.getUint32(0, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50 || offset + 30 > archive.byteLength) {
      throw new Error("pack archive has an invalid local header");
    }
    const flags = header.getUint16(6, true);
    const method = header.getUint16(8, true);
    const crc = header.getUint32(14, true);
    const compressedSize = header.getUint32(18, true);
    const uncompressedSize = header.getUint32(22, true);
    const nameLength = header.getUint16(26, true);
    const extraLength = header.getUint16(28, true);
    if (
      flags !== 0x0800 ||
      method !== 0 ||
      compressedSize !== uncompressedSize
    ) {
      throw new Error(
        "pack archive entries must be stored without descriptors",
      );
    }
    const nameStart = offset + 30;
    const contentStart = nameStart + nameLength + extraLength;
    const contentEnd = contentStart + compressedSize;
    if (contentEnd > archive.byteLength) {
      throw new Error("pack archive entry is truncated");
    }
    const name = Buffer.from(
      archive.slice(nameStart, nameStart + nameLength),
    ).toString("utf8");
    normalizePackPath(name);
    const content = archive.slice(contentStart, contentEnd);
    if (
      seen.has(name) ||
      expected.get(name) !== sha256(content) ||
      crc32(content) !== crc
    ) {
      throw new Error(
        `pack archive entry does not match its manifest: ${name}`,
      );
    }
    seen.add(name);
    offset = contentEnd;
  }
  if (
    seen.size !== expected.size ||
    [...expected.keys()].some((path) => !seen.has(path))
  ) {
    throw new Error(
      "pack archive does not contain exactly the manifest entries",
    );
  }
}

export function buildPack(input: PackBuildInput): PackBuild {
  const files = normalizeFiles(input.files);
  const manifest = buildPackManifest({ ...input, files });
  const manifestFile: PackFile = {
    path: "pack-manifest.json",
    content: canonicalJson(manifest),
  };
  const archive = deterministicZip([...files, manifestFile]);
  validatePackArchive(archive, [
    ...manifest.files.map((file) => file.path),
    "pack-manifest.json",
  ]);
  verifyPackArchive(archive, manifest);
  return {
    manifest,
    archive,
    archiveSha256: sha256(archive),
    archiveSha512: sha512(archive),
    archiveBytes: archive.byteLength,
  };
}
