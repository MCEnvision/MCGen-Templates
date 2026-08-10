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
  });

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
      primaryUrl: "http://example.invalid/metadata.xml",
      prerequisiteUrls: [],
      corroboratingUrls: [],
      removalPolicy: "additive-only",
      requestPolicy: { timeoutMs: 30000, maxBytes: 1048576 },
    });
    expect(result.valid).toBe(false);
  });
});
