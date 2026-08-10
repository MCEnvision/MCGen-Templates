import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";
import {
  buildPack,
  buildPackManifest,
  buildSpdxSbom,
  verifyPackArchive,
} from "../src/pack-builder.js";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";

const input = {
  packVersion: "1.0.0-beta.1",
  sourceCommit: "a".repeat(40),
  createdAt: "2026-08-10T00:00:00.000Z",
  catalogSnapshot: "2026-08-10-r4",
  familyRevisions: [{ id: "fabric", revision: 1 }],
  profileRevisions: [{ id: "fabric", revision: 1 }],
  files: [
    { path: "profiles/fabric.json", content: "profile" },
    { path: "schemas/common.schema.json", content: "schema" },
    { path: "templates/fabric/descriptor.json", content: "template" },
    { path: "catalog/2026-08-10/index.json", content: "catalog" },
  ],
} as const;

describe("phase 6 deterministic pack contracts", () => {
  it("sorts and categorizes content addressed manifest entries", () => {
    const manifest = buildPackManifest(input);
    expect(manifest.files.map((file) => file.path)).toEqual([
      "catalog/2026-08-10/index.json",
      "profiles/fabric.json",
      "schemas/common.schema.json",
      "templates/fabric/descriptor.json",
    ]);
    expect(manifest.schemas).toHaveLength(1);
    expect(manifest.families).toHaveLength(1);
    expect(manifest.profiles).toHaveLength(1);
    expect(manifest.catalogs).toHaveLength(1);
    expect(manifest.catalogSnapshot).toBe("2026-08-10-r4");
  });

  it("builds byte identical archives regardless of input order", async () => {
    const first = buildPack(input);
    const second = buildPack({ ...input, files: [...input.files].reverse() });
    expect(Buffer.from(first.archive).equals(Buffer.from(second.archive))).toBe(
      true,
    );
    expect(first.archiveSha256).toBe(second.archiveSha256);
    expect(first.archiveSha512).toBe(second.archiveSha512);
    expect(first.archiveBytes).toBe(first.archive.byteLength);
    verifyPackArchive(first.archive, first.manifest);
    const registry = await createSchemaRegistry();
    expect(validateWithSchema(registry, first.manifest).valid).toBe(true);
  });

  it("rejects unsafe and duplicate paths", () => {
    expect(() =>
      buildPackManifest({
        ...input,
        files: [{ path: "../secret", content: "x" }],
      }),
    ).toThrow("outside the allowlist");
    expect(() =>
      buildPackManifest({
        ...input,
        files: [
          { path: "schemas/same.txt", content: "a" },
          { path: "schemas/same.txt", content: "b" },
        ],
      }),
    ).toThrow("duplicate path");
    expect(() =>
      buildPackManifest({
        ...input,
        files: [{ path: "CON/file", content: "x" }],
      }),
    ).toThrow("outside the allowlist");
    expect(() =>
      buildPackManifest({ ...input, sourceCommit: "not-a-commit" }),
    ).toThrow("source commit");
    for (const path of [
      "docs/release/build/secret.txt",
      "docs/release/dist/secret.txt",
      "profiles/foo/.git/config",
      "catalog/foo/.gradle/cache",
    ]) {
      expect(() =>
        buildPackManifest({ ...input, files: [{ path, content: "x" }] }),
      ).toThrow("protected");
    }
  });

  it("creates a deterministic SPDX 2.3 file inventory", async () => {
    const manifest = buildPackManifest(input);
    const sbom = buildSpdxSbom(manifest);
    expect(sbom.files.map((file) => file.fileName)).toEqual(
      ["pack-manifest.json", ...manifest.files.map((file) => file.path)].sort(
        (left, right) => left.localeCompare(right),
      ),
    );
    expect(canonicalJson(sbom)).toBe(canonicalJson(buildSpdxSbom(manifest)));
    const registry = await createSchemaRegistry();
    expect(validateWithSchema(registry, sbom).valid).toBe(true);
  });
});
