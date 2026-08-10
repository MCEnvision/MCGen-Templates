import { describe, expect, it } from "vitest";
import { sha256 } from "../src/digest.js";
import type { FetchedResource } from "../src/contracts.js";
import {
  buildJavaSnapshot,
  javaRequirementEntryFromMetadata,
} from "../src/sources/java.js";
import { deriveMojangVersionMetadataResources } from "../src/sources/mojang.js";

const sourceIds = [
  "mojang-version-manifest",
  "forge-getting-started-documentation",
  "neoforge-user-documentation",
  "paper-getting-started-documentation",
  "velocity-getting-started-documentation",
  "architectury-setup-documentation",
] as const;

function resource(
  sourceId: (typeof sourceIds)[number],
  text: string,
): FetchedResource {
  return {
    record: {
      sourceId,
      role:
        sourceId === "mojang-version-manifest" ? "primary" : "corroborating",
      requestedUrl: `https://example.invalid/${sourceId}`,
      url: `https://example.invalid/${sourceId}`,
      redirectChain: [`https://example.invalid/${sourceId}`],
      retrievedAt: "2026-08-10T00:00:00.000Z",
      contentType:
        sourceId === "mojang-version-manifest"
          ? "application/json"
          : "text/html",
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
  ],
});

describe("java source adapter", () => {
  it("does not infer a Java version from a manifest or platform documentation", () => {
    const snapshot = buildJavaSnapshot(
      new Map(
        sourceIds.map((sourceId) => [
          sourceId,
          resource(
            sourceId,
            sourceId === "mojang-version-manifest" ? manifest : "<html />",
          ),
        ]),
      ),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.rejected).toEqual([
      expect.objectContaining({ value: "1.20.1", sourceIndex: 0 }),
    ]);
  });

  it("creates a Java requirement only when exact Mojang metadata supplies it", () => {
    expect(
      javaRequirementEntryFromMetadata(
        "1.20.1",
        JSON.stringify({
          javaVersion: { component: "java-runtime-gamma", majorVersion: 17 },
        }),
        6,
      ),
    ).toMatchObject({
      catalogKey: "1.20.1",
      version: "17",
      sourceIndexes: [6],
    });
  });

  it("preserves manifest provenance when creating Java requirements", () => {
    const manifestResource = resource("mojang-version-manifest", manifest);
    const [derived] = deriveMojangVersionMetadataResources(
      new Map([["mojang-version-manifest", manifestResource]]),
    );
    if (!derived) {
      throw new Error("expected derived Mojang metadata source");
    }
    expect(derived).toMatchObject({
      id: "mojang-version-metadata",
      key: "mojang-version-metadata:1.20.1",
      derivedFrom: {
        sourceId: "mojang-version-manifest",
        sha256: manifestResource.record.sha256,
        selector: "version:1.20.1",
      },
    });
    const metadata = JSON.stringify({
      javaVersion: { component: "java-runtime-gamma", majorVersion: 17 },
    });
    const snapshot = buildJavaSnapshot(
      new Map([
        ...sourceIds.map(
          (sourceId) =>
            [
              sourceId,
              resource(
                sourceId,
                sourceId === "mojang-version-manifest" ? manifest : "<html />",
              ),
            ] as const,
        ),
        [
          derived.key,
          {
            record: {
              sourceId: derived.id,
              role: derived.role,
              requestedUrl: derived.url,
              url: derived.url,
              redirectChain: [derived.url],
              retrievedAt: "2026-08-10T00:00:00.000Z",
              contentType: "application/json",
              sha256: sha256(metadata),
              bytes: Buffer.byteLength(metadata),
              derivedFrom: derived.derivedFrom,
            },
            text: metadata,
          },
        ],
      ]),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.entries).toEqual([
      expect.objectContaining({
        catalogKey: "1.20.1",
        version: "17",
        sourceIndexes: [6],
      }),
    ]);
    expect(snapshot.rejected).toEqual([]);
  });
});
