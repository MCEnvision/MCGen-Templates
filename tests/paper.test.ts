import { describe, expect, it } from "vitest";
import { sha256 } from "../src/digest.js";
import type { FetchedResource } from "../src/contracts.js";
import {
  buildPaperSnapshot,
  derivePaperFillBuildResources,
  parsePaperFillBuilds,
  parsePaperFillProject,
} from "../src/sources/paper.js";

function resource(sourceId: string, text: string): FetchedResource {
  return {
    record: {
      sourceId,
      role: sourceId === "paper-fill-project" ? "primary" : "prerequisite",
      requestedUrl: `https://example.invalid/${sourceId}`,
      url: `https://example.invalid/${sourceId}`,
      redirectChain: [`https://example.invalid/${sourceId}`],
      retrievedAt: "2026-08-10T00:00:00.000Z",
      contentType:
        sourceId === "paper-fill-project"
          ? "application/json"
          : "application/xml",
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
    },
    text,
  };
}

const project = JSON.stringify({
  project: { id: "paper", name: "Paper" },
  versions: {
    "1.21": ["1.21.1", "1.21"],
    "1.20": ["1.20.6"],
  },
});

function buildsResource(version: string, text: string): FetchedResource {
  const url = `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`;
  return {
    record: {
      sourceId: "paper-fill-builds",
      role: "prerequisite",
      requestedUrl: url,
      url,
      redirectChain: [url],
      retrievedAt: "2026-08-10T00:00:00.000Z",
      contentType: "application/json",
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
      derivedFrom: {
        sourceId: "paper-fill-project",
        sha256: sha256(project),
        selector: `version:${version}`,
      },
    },
    text,
  };
}

function buildResponses() {
  return [
    [
      "paper-fill-builds:1.20.6",
      buildsResource("1.20.6", JSON.stringify({ builds: [{ id: 2 }] })),
    ],
    [
      "paper-fill-builds:1.21",
      buildsResource("1.21", JSON.stringify({ builds: [{ id: 3 }] })),
    ],
    [
      "paper-fill-builds:1.21.1",
      buildsResource(
        "1.21.1",
        JSON.stringify({ builds: [{ id: 4, channel: "stable" }] }),
      ),
    ],
  ] as const;
}

describe("paper source adapter", () => {
  it("keeps server releases and API artifacts separate under exact published keys", () => {
    const snapshot = buildPaperSnapshot(
      new Map([
        ["paper-fill-project", resource("paper-fill-project", project)],
        [
          "paper-api-maven-metadata",
          resource(
            "paper-api-maven-metadata",
            "<metadata><versioning><versions><version>1.21.1-R0.1-SNAPSHOT</version><version>1.20.6-R0.1-SNAPSHOT</version></versions></versioning></metadata>",
          ),
        ],
        ...buildResponses(),
      ]),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.entries).toHaveLength(8);
    expect(
      snapshot.entries.filter((entry) => entry.component === "paper-api"),
    ).toEqual([
      expect.objectContaining({ catalogKey: "1.20.6", sourceIndexes: [0, 1] }),
      expect.objectContaining({ catalogKey: "1.21.1", sourceIndexes: [0, 1] }),
    ]);
    expect(snapshot.rejected).toEqual([]);
  });

  it("does not invent an API compatibility key absent from Paper Fill", () => {
    const snapshot = buildPaperSnapshot(
      new Map([
        ["paper-fill-project", resource("paper-fill-project", project)],
        [
          "paper-api-maven-metadata",
          resource(
            "paper-api-maven-metadata",
            "<metadata><versioning><versions><version>1.21.2-R0.1-SNAPSHOT</version></versions></versioning></metadata>",
          ),
        ],
        ...buildResponses(),
      ]),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.entries).toHaveLength(6);
    expect(snapshot.rejected).toEqual([
      expect.objectContaining({
        value: "1.21.2-R0.1-SNAPSHOT",
        sourceIndex: 1,
      }),
    ]);
  });

  it("rejects a response for another Fill project", () => {
    expect(() =>
      parsePaperFillProject(
        JSON.stringify({ project: { id: "velocity" }, versions: {} }),
      ),
    ).toThrow("paper fill response is not the paper project");
  });

  it("derives build sources only from validated Paper Fill versions", () => {
    expect(
      derivePaperFillBuildResources(
        new Map([
          ["paper-fill-project", resource("paper-fill-project", project)],
        ]),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "paper-fill-builds",
          key: "paper-fill-builds:1.21.1",
          url: "https://fill.papermc.io/v3/projects/paper/versions/1.21.1/builds",
        }),
      ]),
    );
  });

  it("rejects a malformed official Paper Fill build record", () => {
    expect(() =>
      parsePaperFillBuilds(JSON.stringify({ builds: [{ id: 0 }] })),
    ).toThrow("paper Fill build id is invalid");
  });
});
