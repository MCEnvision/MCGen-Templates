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

function paperBuild(id: number, channel = "stable") {
  return {
    id,
    channel,
    downloads: {
      "server:default": {
        name: `paper-test-${id}.jar`,
        size: id,
        url: `https://fill-data.papermc.io/v1/objects/${String(id).padStart(64, "0")}/paper-test-${id}.jar`,
        checksums: { sha256: String(id).padStart(64, "0") },
      },
    },
  };
}

function buildResponses() {
  return [
    [
      "paper-fill-builds:1.20.6",
      buildsResource("1.20.6", JSON.stringify([paperBuild(2)])),
    ],
    [
      "paper-fill-builds:1.21",
      buildsResource("1.21", JSON.stringify([paperBuild(3)])),
    ],
    [
      "paper-fill-builds:1.21.1",
      buildsResource("1.21.1", JSON.stringify([paperBuild(4)])),
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
    expect(() => parsePaperFillBuilds(JSON.stringify([{ id: 0 }]))).toThrow(
      "paper Fill build id is invalid",
    );
  });

  it("parses official array responses with exact server download evidence", () => {
    const builds = parsePaperFillBuilds(
      JSON.stringify([paperBuild(9, "STABLE")]),
    );
    expect(builds).toHaveLength(1);
    const build = builds[0];
    if (!build) throw new Error("paper Fill test omitted its parsed build");
    expect(build.id).toBe("9");
    expect(build.channel).toBe("release");
    expect(build.download).toEqual({
      name: "paper-test-9.jar",
      sha256:
        "0000000000000000000000000000000000000000000000000000000000000009",
      size: "9",
      url: "https://fill-data.papermc.io/v1/objects/0000000000000000000000000000000000000000000000000000000000000009/paper-test-9.jar",
    });
  });
});
