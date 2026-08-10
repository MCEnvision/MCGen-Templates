import { describe, expect, it } from "vitest";
import type { FetchedResource } from "../src/contracts.js";
import { sha256 } from "../src/digest.js";
import { requireSourceAdapter } from "../src/source-adapters.js";
import { buildFabricSnapshot } from "../src/sources/fabric.js";
import {
  buildNeoForgeSnapshot,
  minecraftKeyFromNeoForgeVersion,
} from "../src/sources/neoforge.js";

function resource(sourceId: string, text: string): FetchedResource {
  const url = `https://example.invalid/${sourceId}`;
  return {
    record: {
      sourceId,
      role: sourceId.endsWith("documentation") ? "corroborating" : "primary",
      requestedUrl: url,
      url,
      redirectChain: [url],
      retrievedAt: "2026-08-10T00:00:00.000Z",
      contentType: sourceId.includes("maven")
        ? "application/xml"
        : "application/json",
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
    },
    text,
  };
}

function maven(...versions: string[]): string {
  return `<metadata><versioning><versions>${versions
    .map((version) => `<version>${version}</version>`)
    .join("")}</versions></versioning></metadata>`;
}

function fabricResources(): Map<string, FetchedResource> {
  return new Map([
    [
      "fabric-meta-game",
      resource(
        "fabric-meta-game",
        JSON.stringify([
          { version: "1.21.1", stable: true },
          { version: "1.21.2-pre1", stable: false },
          { version: "24w14a", stable: false },
          { version: "", stable: false },
        ]),
      ),
    ],
    [
      "fabric-meta-loader",
      resource(
        "fabric-meta-loader",
        JSON.stringify([
          {
            version: "0.16.10",
            stable: true,
            maven: "net.fabricmc:fabric-loader:0.16.10",
          },
        ]),
      ),
    ],
    [
      "fabric-meta-yarn",
      resource(
        "fabric-meta-yarn",
        JSON.stringify([
          {
            version: "1.21.1+build.3",
            stable: true,
            maven: "net.fabricmc:yarn:1.21.1+build.3:v2",
          },
        ]),
      ),
    ],
    [
      "fabric-meta-intermediary",
      resource(
        "fabric-meta-intermediary",
        JSON.stringify([
          {
            version: "1.21.1",
            stable: true,
            maven: "net.fabricmc:intermediary:1.21.1:v2",
          },
        ]),
      ),
    ],
    [
      "fabric-meta-installer",
      resource(
        "fabric-meta-installer",
        JSON.stringify([
          {
            version: "1.0.1",
            stable: true,
            maven: "net.fabricmc:fabric-installer:1.0.1",
          },
        ]),
      ),
    ],
    [
      "fabric-api-maven-metadata",
      resource("fabric-api-maven-metadata", maven("0.102.0+1.21.1", "0.102.1")),
    ],
    [
      "fabric-loom-maven-metadata",
      resource("fabric-loom-maven-metadata", maven("1.9.3")),
    ],
    [
      "fabric-language-kotlin-maven-metadata",
      resource(
        "fabric-language-kotlin-maven-metadata",
        maven("1.13.2+kotlin.2.1.0"),
      ),
    ],
  ]);
}

function neoForgeResources(): Map<string, FetchedResource> {
  return new Map([
    [
      "neoforge-maven-metadata",
      resource("neoforge-maven-metadata", maven("20.2.12-beta", "21.1.99")),
    ],
    [
      "neoforge-moddevgradle-maven-metadata",
      resource("neoforge-moddevgradle-maven-metadata", maven("2.0.120")),
    ],
    [
      "neoforge-userdev-maven-metadata",
      resource("neoforge-userdev-maven-metadata", maven("21.1.99")),
    ],
    [
      "neoforge-common-maven-metadata",
      resource("neoforge-common-maven-metadata", maven("21.1.99")),
    ],
    [
      "neoforge-neoform-maven-metadata",
      resource(
        "neoforge-neoform-maven-metadata",
        maven("1.21.1-20240808.171142"),
      ),
    ],
    [
      "neoforge-neoform-runtime-maven-metadata",
      resource("neoforge-neoform-runtime-maven-metadata", maven("26.1.0.1")),
    ],
    [
      "neoforge-versioning-documentation",
      resource(
        "neoforge-versioning-documentation",
        "<html>documentation</html>",
      ),
    ],
  ]);
}

describe("fabric source adapter", () => {
  it("registers the exact fabric source definition contract", () => {
    expect(requireSourceAdapter("fabric").requiredSourceIds).toEqual([
      "fabric-meta-game",
      "fabric-meta-loader",
      "fabric-meta-yarn",
      "fabric-meta-intermediary",
      "fabric-meta-installer",
      "fabric-api-maven-metadata",
      "fabric-loom-maven-metadata",
      "fabric-language-kotlin-maven-metadata",
    ]);
  });

  it("captures every declared source and accounts for invalid records", () => {
    const snapshot = buildFabricSnapshot(
      fabricResources(),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.sources).toHaveLength(8);
    expect(snapshot.entries).toHaveLength(11);
    expect(snapshot.entries.some((entry) => entry.component === "loader")).toBe(
      true,
    );
    expect(
      snapshot.entries.find((entry) => entry.component === "mappings-yarn"),
    ).toMatchObject({ catalogKey: "1.21.1", sourceIndexes: [2] });
    expect(snapshot.entries).toContainEqual(
      expect.objectContaining({
        component: "minecraft",
        version: "24w14a",
        catalogKey: "unresolved",
        compatibility: "unresolved",
        channel: "snapshot",
      }),
    );
    expect(snapshot.entries).toContainEqual(
      expect.objectContaining({
        component: "fabric-api",
        version: "0.102.1",
        catalogKey: "unresolved",
        compatibility: "unresolved",
      }),
    );
    expect(snapshot.rejected).toEqual([
      {
        value: "record 3",
        reason: "fabric-meta-game record must contain a nonempty version",
        sourceIndex: 0,
      },
    ]);
    expect(snapshot.warnings).toEqual([
      "1 fabric records are structurally invalid",
    ]);
  });

  it("refuses malformed fabric metadata and incomplete source sets", () => {
    const malformed = fabricResources();
    malformed.set("fabric-meta-game", resource("fabric-meta-game", "{}"));
    expect(() =>
      buildFabricSnapshot(malformed, "2026-08-10T00:00:00.000Z"),
    ).toThrow("fabric-meta-game response must be an array");
    expect(() =>
      buildFabricSnapshot(new Map(), "2026-08-10T00:00:00.000Z"),
    ).toThrow("fabric adapter requires source fabric-meta-game");
  });
});

describe("neoforge source adapter", () => {
  it("registers the exact neoforge source definition contract", () => {
    expect(requireSourceAdapter("neoforge").requiredSourceIds).toEqual([
      "neoforge-maven-metadata",
      "neoforge-moddevgradle-maven-metadata",
      "neoforge-userdev-maven-metadata",
      "neoforge-common-maven-metadata",
      "neoforge-neoform-maven-metadata",
      "neoforge-neoform-runtime-maven-metadata",
      "neoforge-versioning-documentation",
    ]);
  });

  it("uses the documented neoforge version scheme without compatibility inference", () => {
    expect(minecraftKeyFromNeoForgeVersion("20.2.12-beta")).toBe("1.20.2");
    expect(minecraftKeyFromNeoForgeVersion("21.0.167")).toBe("1.21");
    expect(minecraftKeyFromNeoForgeVersion("26.1.0.1")).toBe("26.1");
    expect(minecraftKeyFromNeoForgeVersion("legacy")).toBeUndefined();

    const snapshot = buildNeoForgeSnapshot(
      neoForgeResources(),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.sources).toHaveLength(7);
    expect(snapshot.entries).toHaveLength(7);
    expect(snapshot.entries).toContainEqual(
      expect.objectContaining({
        component: "loader",
        catalogKey: "1.20.2",
        version: "20.2.12-beta",
      }),
    );
    expect(snapshot.entries).toContainEqual(
      expect.objectContaining({
        component: "neoform-runtime",
        catalogKey: "26.1",
      }),
    );
    expect(snapshot.rejected).toEqual([]);
    expect(snapshot.warnings).toEqual([
      "neoforge-versioning-documentation is preserved as corroborating evidence",
    ]);
  });

  it("preserves unkeyed neoforge versions without creating compatibility evidence", () => {
    const resources = neoForgeResources();
    resources.set(
      "neoforge-maven-metadata",
      resource("neoforge-maven-metadata", maven("21.1.99", "legacy")),
    );
    const snapshot = buildNeoForgeSnapshot(
      resources,
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.rejected).toEqual([]);
    expect(snapshot.entries).toContainEqual(
      expect.objectContaining({
        component: "loader",
        version: "legacy",
        catalogKey: "unresolved",
        compatibility: "unresolved",
        channel: "release",
      }),
    );
  });
});
