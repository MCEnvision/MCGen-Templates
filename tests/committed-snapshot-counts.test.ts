import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { SourceSnapshot } from "../src/contracts.js";
import { repositoryRoot } from "../src/schema-registry.js";
import { resolve } from "node:path";

const expectedCounts = {
  "sources/snapshots/architectury/2026-08-10-r2.json": {
    entries: 1130,
    rejected: 0,
    sources: 5,
  },
  "sources/snapshots/architectury/2026-08-10.json": {
    entries: 1130,
    rejected: 0,
    sources: 5,
  },
  "sources/snapshots/bukkit/2026-08-10-r2.json": {
    entries: 37,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/bukkit/2026-08-10.json": {
    entries: 37,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/bungeecord/2026-08-10-r2.json": {
    entries: 21,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/bungeecord/2026-08-10.json": {
    entries: 21,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/fabric/2026-08-10-r2.json": {
    entries: 6866,
    rejected: 0,
    sources: 8,
  },
  "sources/snapshots/fabric/2026-08-10.json": {
    entries: 4011,
    rejected: 2855,
    sources: 8,
  },
  "sources/snapshots/forge/2026-08-09.json": {
    entries: 5033,
    rejected: 0,
    sources: 2,
  },
  "sources/snapshots/forge/2026-08-10-r2.json": {
    entries: 8390,
    rejected: 1,
    sources: 7,
  },
  "sources/snapshots/forge/2026-08-10.json": {
    entries: 8390,
    rejected: 1,
    sources: 7,
  },
  "sources/snapshots/gradle/2026-08-10-r2.json": {
    entries: 521,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/gradle/2026-08-10.json": {
    entries: 521,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/java/2026-08-10-r2.json": {
    entries: 887,
    rejected: 18,
    sources: 911,
  },
  "sources/snapshots/java/2026-08-10.json": {
    entries: 0,
    rejected: 905,
    sources: 6,
  },
  "sources/snapshots/kotlin/2026-08-10-r2.json": {
    entries: 204,
    rejected: 0,
    sources: 2,
  },
  "sources/snapshots/kotlin/2026-08-10.json": {
    entries: 204,
    rejected: 0,
    sources: 2,
  },
  "sources/snapshots/mojang/2026-08-10-r2.json": {
    entries: 905,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/mojang/2026-08-10.json": {
    entries: 905,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/neoforge/2026-08-10-r2.json": {
    entries: 2568,
    rejected: 0,
    sources: 7,
  },
  "sources/snapshots/neoforge/2026-08-10.json": {
    entries: 1902,
    rejected: 666,
    sources: 7,
  },
  "sources/snapshots/paper/2026-08-10-r2.json": {
    entries: 301,
    rejected: 67,
    sources: 68,
  },
  "sources/snapshots/paper/2026-08-10-r3.json": {
    entries: 5879,
    rejected: 2,
    sources: 68,
  },
  "sources/snapshots/paper/2026-08-10.json": {
    entries: 301,
    rejected: 1,
    sources: 2,
  },
  "sources/snapshots/spigot/2026-08-10-r2.json": {
    entries: 82,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/spigot/2026-08-10.json": {
    entries: 82,
    rejected: 0,
    sources: 1,
  },
  "sources/snapshots/sponge/2026-08-10-r2.json": {
    entries: 74,
    rejected: 0,
    sources: 3,
  },
  "sources/snapshots/sponge/2026-08-10.json": {
    entries: 74,
    rejected: 0,
    sources: 3,
  },
  "sources/snapshots/velocity/2026-08-10-r2.json": {
    entries: 66,
    rejected: 0,
    sources: 3,
  },
  "sources/snapshots/velocity/2026-08-10.json": {
    entries: 66,
    rejected: 0,
    sources: 3,
  },
} as const;

describe("committed source snapshot counts", () => {
  it("pins exact entry, rejection, and source-record counts", async () => {
    await Promise.all(
      Object.entries(expectedCounts).map(async ([path, expected]) => {
        const snapshot = JSON.parse(
          await readFile(resolve(repositoryRoot, path), "utf8"),
        ) as SourceSnapshot;
        expect({
          entries: snapshot.entries.length,
          rejected: snapshot.rejected.length,
          sources: snapshot.sources.length,
        }).toEqual(expected);
      }),
    );
  });
});
