import { describe, expect, it } from "vitest";
import { sha256 } from "../src/digest.js";
import type { FetchedResource } from "../src/contracts.js";
import {
  buildMojangSnapshot,
  parseMojangJavaRequirement,
  parseMojangManifest,
  parseMojangVersionIds,
} from "../src/sources/mojang.js";

function resource(text: string): FetchedResource {
  return {
    record: {
      sourceId: "mojang-version-manifest",
      role: "primary",
      requestedUrl:
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      url: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      redirectChain: [
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      ],
      retrievedAt: "2026-08-10T00:00:00.000Z",
      contentType: "application/json",
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
    },
    text,
  };
}

const manifest = JSON.stringify({
  versions: [
    {
      id: "1.20.1",
      type: "release",
      sha1: "a".repeat(40),
      url: `https://piston-meta.mojang.com/v1/packages/${"a".repeat(40)}/1.20.1.json`,
    },
    {
      id: "24w14a",
      type: "snapshot",
      sha1: "b".repeat(40),
      url: `https://piston-meta.mojang.com/v1/packages/${"b".repeat(40)}/24w14a.json`,
    },
  ],
});

describe("mojang source adapter", () => {
  it("preserves every manifest version with the exact published metadata locator", () => {
    expect(parseMojangVersionIds(manifest)).toEqual(["1.20.1", "24w14a"]);
    expect(parseMojangManifest(manifest).versions[0]).toMatchObject({
      id: "1.20.1",
      sha1: "a".repeat(40),
    });
    const snapshot = buildMojangSnapshot(
      new Map([["mojang-version-manifest", resource(manifest)]]),
      "2026-08-10T00:00:00.000Z",
    );
    expect(
      snapshot.entries.map((entry) => [entry.catalogKey, entry.channel]),
    ).toEqual([
      ["1.20.1", "release"],
      ["24w14a", "snapshot"],
    ]);
    expect(snapshot.entries[0]?.details?.["metadataUrl"]).toContain(
      "1.20.1.json",
    );
  });

  it.each([
    [
      JSON.stringify({ versions: [] }),
      "mojang manifest does not contain a versions array",
    ],
    [
      JSON.stringify({
        versions: [
          {
            id: "1.20.1",
            type: "release",
            sha1: "a".repeat(40),
            url: "https://piston-meta.mojang.com/v1/packages/wrong/1.20.1.json",
          },
        ],
      }),
      "mojang manifest version url does not match its id and sha1",
    ],
  ])("rejects untrusted manifest metadata locators", (input, message) => {
    expect(() => parseMojangManifest(input)).toThrow(message);
  });

  it("parses a Java requirement only from official Minecraft version metadata", () => {
    expect(
      parseMojangJavaRequirement(
        JSON.stringify({
          javaVersion: { component: "java-runtime-gamma", majorVersion: 21 },
        }),
      ),
    ).toEqual({ component: "java-runtime-gamma", majorVersion: 21 });
  });
});
