import { describe, expect, it } from "vitest";
import {
  createSchemaRegistry,
  validateWithSchema,
} from "../src/schema-registry.js";
import { canonicalJsonFiles, validateFiles } from "../src/validate.js";

describe("schema registry", () => {
  it("validates every canonical repository document", async () => {
    const files = await canonicalJsonFiles();
    expect(files.length).toBeGreaterThan(0);
    expect(await validateFiles(files)).toEqual([]);
  }, 120000);

  it("rejects an unregistered schema", async () => {
    const registry = await createSchemaRegistry();
    const result = validateWithSchema(registry, {
      $schema: "urn:mcgen:schema:unknown:1",
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toContain(
      "not a registered mcgen schema",
    );
  });

  it("rejects insecure source endpoints", async () => {
    const registry = await createSchemaRegistry();
    const result = validateWithSchema(registry, {
      $schema: "urn:mcgen:schema:source-definition:1",
      schemaVersion: 1,
      id: "forge",
      platform: "forge",
      category: "mod",
      adapter: "forge-maven",
      sources: [
        {
          id: "forge-maven-metadata",
          role: "primary",
          url: "http://example.invalid/metadata.xml",
          expectedContentTypes: ["application/xml"],
        },
      ],
      removalPolicy: "additive-only",
      requestPolicy: { timeoutMs: 30000, maxBytes: 1048576 },
    });
    expect(result.valid).toBe(false);
  });

  it("requires complete approved provenance for a phase 3 snapshot", async () => {
    const registry = await createSchemaRegistry();
    const snapshot = {
      $schema: "urn:mcgen:schema:source-snapshot:1",
      schemaVersion: 1,
      provenanceVersion: 1,
      snapshotId: "forge.test",
      adapter: { id: "forge-maven", version: "1.0.2" },
      createdAt: "2026-08-10T00:00:00.000Z",
      sources: [
        {
          sourceId: "mojang-version-manifest",
          role: "prerequisite",
          requestedUrl:
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
          url: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
          redirectChain: [
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
          ],
          retrievedAt: "2026-08-10T00:00:00.000Z",
          contentType: "application/json",
          sha256: "0".repeat(64),
          bytes: 1,
        },
      ],
      entries: [],
      rejected: [],
      warnings: [],
    };
    expect(validateWithSchema(registry, snapshot).valid).toBe(true);
    expect(
      validateWithSchema(registry, {
        ...snapshot,
        sources: [{ ...snapshot.sources[0], role: undefined }],
      }).valid,
    ).toBe(false);
  });
});
