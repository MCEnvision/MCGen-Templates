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

  it("allows distinct records that share a Java coordinate identity", () => {
    const previous = snapshot("java.previous", ["com.mojang:jre:java-8"]);
    const entry = previous.entries[0];
    if (!entry) throw new Error("expected a Java entry");
    const repeated = {
      ...previous,
      entries: [
        entry,
        {
          ...entry,
          catalogKey: "1.21.1",
          details: {
            minecraftVersion: "1.21.1",
            runtimeComponent: "jre",
            majorVersion: "8",
          },
        },
      ],
    };
    const second = repeated.entries[1];
    if (!second) throw new Error("expected the repeated Java entry");
    const candidate = {
      ...repeated,
      snapshotId: "java.candidate",
      entries: [
        entry,
        {
          ...second,
          details: {
            minecraftVersion: "1.21.1",
            runtimeComponent: "jre-updated",
            majorVersion: "8",
          },
        },
      ],
    };

    expect(reconcileSnapshots(repeated, repeated)).toMatchObject({
      addedCoordinates: [],
      removedCoordinates: [],
      changedSources: [],
      requiresReview: false,
    });
    expect(reconcileSnapshots(repeated, candidate)).toMatchObject({
      addedCoordinates: [],
      removedCoordinates: [],
      changedSources: [],
      requiresReview: false,
    });
  });

  it("allows distinct source records that share a Paper source id", () => {
    const previous = snapshot("paper.previous", ["paper:1"]);
    const source = previous.sources[0];
    if (!source) throw new Error("expected a Paper source");
    const repeated = {
      ...previous,
      sources: [
        source,
        {
          ...source,
          sha256: "b",
          bytes: 2,
          retrievedAt: "2026-08-10T00:00:01.000Z",
        },
      ],
    };

    expect(reconcileSnapshots(repeated, repeated)).toMatchObject({
      addedCoordinates: [],
      removedCoordinates: [],
      changedSources: [],
      requiresReview: false,
    });
  });

  it("rejects exact duplicate entry records", () => {
    const base = snapshot("duplicate-entry", ["paper:1"]);
    const entry = base.entries[0];
    if (!entry) throw new Error("expected an entry");
    const duplicate = { ...base, entries: [entry, { ...entry }] };

    expect(() => reconcileSnapshots(duplicate, duplicate)).toThrow(
      "repeats exact entry record paper:1",
    );
  });

  it("rejects exact duplicate source records", () => {
    const base = snapshot("duplicate-source", ["paper:1"]);
    const source = base.sources[0];
    if (!source) throw new Error("expected a source");
    const duplicate = { ...base, sources: [source, { ...source }] };

    expect(() => reconcileSnapshots(duplicate, duplicate)).toThrow(
      "repeats exact source record forge-maven-metadata",
    );
  });

  it("reports a repeated source id as one grouped source mutation", () => {
    const previous = snapshot("paper.previous", ["paper:1"]);
    const source = previous.sources[0];
    if (!source) throw new Error("expected a Paper source");
    const previousWithRepeatedSource = {
      ...previous,
      sources: [
        source,
        {
          ...source,
          sha256: "b",
          bytes: 2,
          retrievedAt: "2026-08-10T00:00:01.000Z",
        },
      ],
    };
    const candidateWithRepeatedSource = {
      ...previousWithRepeatedSource,
      snapshotId: "paper.candidate",
      sources: [
        source,
        {
          ...source,
          sha256: "c",
          bytes: 3,
          retrievedAt: "2026-08-10T00:00:02.000Z",
        },
      ],
    };

    expect(
      reconcileSnapshots(
        previousWithRepeatedSource,
        candidateWithRepeatedSource,
      ).changedSources,
    ).toMatchObject([
      {
        sourceId: "forge-maven-metadata",
      },
    ]);
  });
});
