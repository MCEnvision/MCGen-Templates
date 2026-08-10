import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { sha256 } from "../src/digest.js";
import type { FetchedResource } from "../src/contracts.js";
import {
  buildForgeSnapshot,
  normalizeForgeVersions,
  parseForgeVersions,
} from "../src/sources/forge.js";

const fixtureUrl = new URL(
  "fixtures/forge-maven-metadata.xml",
  import.meta.url,
);

function resource(
  sourceId: string,
  url: string,
  text: string,
): FetchedResource {
  return {
    record: {
      sourceId,
      role:
        sourceId === "forge-maven-metadata"
          ? "primary"
          : sourceId === "forge-promotions"
            ? "corroborating"
            : "prerequisite",
      requestedUrl: url,
      url,
      redirectChain: [url],
      retrievedAt: "2026-08-09T00:00:00.000Z",
      contentType: url.endsWith(".json")
        ? "application/json"
        : "application/xml",
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
    },
    text,
  };
}

function forgeResources(manifest: string, forge: string) {
  return new Map([
    [
      "mojang-version-manifest",
      resource(
        "mojang-version-manifest",
        "https://example.invalid/manifest.json",
        manifest,
      ),
    ],
    [
      "forge-maven-metadata",
      resource(
        "forge-maven-metadata",
        "https://example.invalid/forge.xml",
        forge,
      ),
    ],
    [
      "forgegradle-maven-metadata",
      resource(
        "forgegradle-maven-metadata",
        "https://example.invalid/forgegradle.xml",
        "<metadata><versioning><versions><version>1.0</version></versions></versioning></metadata>",
      ),
    ],
    [
      "mcp-config-maven-metadata",
      resource(
        "mcp-config-maven-metadata",
        "https://example.invalid/mcp-config.xml",
        "<metadata><versioning><versions><version>1.0</version></versions></versioning></metadata>",
      ),
    ],
    [
      "mcp-snapshot-maven-metadata",
      resource(
        "mcp-snapshot-maven-metadata",
        "https://example.invalid/mcp-snapshot.xml",
        "<metadata><versioning><versions><version>1.0</version></versions></versioning></metadata>",
      ),
    ],
    [
      "mcp-stable-maven-metadata",
      resource(
        "mcp-stable-maven-metadata",
        "https://example.invalid/mcp-stable.xml",
        "<metadata><versioning><versions><version>1.0</version></versions></versioning></metadata>",
      ),
    ],
    [
      "forge-promotions",
      resource(
        "forge-promotions",
        "https://example.invalid/promotions.json",
        "{}",
      ),
    ],
  ]);
}

describe("forge source adapter", () => {
  it("keeps every exact forge artifact under its exact minecraft key", async () => {
    const xml = await readFile(fixtureUrl, "utf8");
    const versions = parseForgeVersions(xml);
    const normalized = normalizeForgeVersions(versions, [
      "1.8.9",
      "1.20.1",
      "1.20.3",
    ]);
    expect(
      normalized.entries.map(({ catalogKey, version }) => [
        catalogKey,
        version,
      ]),
    ).toEqual([
      ["1.20.1", "1.20.1-47.6.0"],
      ["1.20.1", "1.20.1-47.7.0"],
      ["1.20.3", "1.20.3-49.0.2"],
      ["1.8.9", "1.8.9-11.15.1.2318-1.8.9"],
    ]);
    expect(normalized.rejected).toEqual([
      {
        value: "unknown-coordinate",
        reason: "no exact mojang version prefix matched the forge coordinate",
        sourceIndex: 1,
      },
    ]);
    expect(normalized.warnings).toEqual([]);
  });

  it("derives snapshot identity from adapter and source bytes", async () => {
    const xml = await readFile(fixtureUrl, "utf8");
    const manifest = JSON.stringify({
      versions: [{ id: "1.8.9" }, { id: "1.20.1" }, { id: "1.20.3" }],
    });
    const first = buildForgeSnapshot(
      forgeResources(manifest, xml),
      "2026-08-09T00:00:00.000Z",
    );
    const second = buildForgeSnapshot(
      forgeResources(manifest, xml),
      "2026-08-10T00:00:00.000Z",
    );
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.provenanceVersion).toBe(1);
    expect(first.sources).toHaveLength(7);
    expect(first.entries).toHaveLength(4);
    expect(first.rejected).toHaveLength(1);
  });

  it("preserves strict forge-only historic catalog keys", () => {
    const normalized = normalizeForgeVersions(
      ["1.4.0-5.0.0.320", "1.7.10_pre4-10.12.2.1137-prerelease"],
      ["1.4.1", "1.7.10"],
    );
    expect(
      normalized.entries.map(({ catalogKey, sourceIndexes }) => [
        catalogKey,
        sourceIndexes,
      ]),
    ).toEqual([
      ["1.4.0", [1]],
      ["1.7.10_pre4", [1]],
    ]);
    expect(normalized.rejected).toEqual([]);
    expect(normalized.warnings).toEqual([
      "catalog key 1.4.0 was derived from official forge coordinates because it is absent from the current mojang manifest",
      "catalog key 1.7.10_pre4 was derived from official forge coordinates because it is absent from the current mojang manifest",
    ]);
    expect(normalized.entries[1]?.channel).toBe("release-candidate");
  });

  it("rejects empty forge metadata", () => {
    expect(() => parseForgeVersions("<metadata />")).toThrow(
      "forge maven metadata contains no versions",
    );
  });

  it("refuses to capture a partially declared forge source set", () => {
    expect(() =>
      buildForgeSnapshot(new Map(), "2026-08-09T00:00:00.000Z"),
    ).toThrow("forge adapter requires source mojang-version-manifest");
  });
});
