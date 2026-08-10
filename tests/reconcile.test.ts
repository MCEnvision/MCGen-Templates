import { describe, expect, it } from "vitest";
import type { SourceSnapshot } from "../src/contracts.js";
import { reconcileSnapshots } from "../src/reconcile.js";

function snapshot(
  snapshotId: string,
  coordinates: readonly string[],
  sourceSha256 = "a",
): SourceSnapshot {
  return {
    $schema: "urn:mcgen:schema:source-snapshot:1",
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId,
    adapter: { id: "forge-maven", version: "1" },
    createdAt: "2026-08-10T00:00:00.000Z",
    sources: [
      {
        sourceId: "forge-maven-metadata",
        role: "primary",
        requestedUrl:
          "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
        url: "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml",
        redirectChain: [
          "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
          "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml",
        ],
        retrievedAt: "2026-08-10T00:00:00.000Z",
        contentType: "application/xml",
        sha256: sourceSha256,
        bytes: 1,
      },
    ],
    entries: coordinates.map((coordinate, index) => ({
      platform: "forge",
      component: "loader",
      catalogKey: "1.20.1",
      version: coordinate,
      coordinate,
      channel: "release",
      sourceIndexes: [index === 0 ? 0 : 0],
    })),
    rejected: [],
    warnings: [],
  };
}

describe("snapshot reconciliation", () => {
  it("allows additive coordinates without a review requirement", () => {
    expect(
      reconcileSnapshots(
        snapshot("forge.previous", ["net.minecraftforge:forge:1.20.1-47.1.0"]),
        snapshot("forge.candidate", [
          "net.minecraftforge:forge:1.20.1-47.1.0",
          "net.minecraftforge:forge:1.20.1-47.2.0",
        ]),
      ),
    ).toMatchObject({
      addedCoordinates: ["net.minecraftforge:forge:1.20.1-47.2.0"],
      removedCoordinates: [],
      changedSources: [],
      requiresReview: false,
    });
  });

  it("quarantines removals and source mutations for review", () => {
    expect(
      reconcileSnapshots(
        snapshot(
          "forge.previous",
          [
            "net.minecraftforge:forge:1.20.1-47.1.0",
            "net.minecraftforge:forge:1.20.1-47.2.0",
          ],
          "a",
        ),
        snapshot(
          "forge.candidate",
          ["net.minecraftforge:forge:1.20.1-47.1.0"],
          "b",
        ),
      ),
    ).toMatchObject({
      removedCoordinates: ["net.minecraftforge:forge:1.20.1-47.2.0"],
      changedSources: [
        {
          sourceId: "forge-maven-metadata",
          previousSha256: "a",
          candidateSha256: "b",
        },
      ],
      requiresReview: true,
    });
  });
});
