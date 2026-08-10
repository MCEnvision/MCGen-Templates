import { canonicalJson, compareText } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
  type StabilityChannel,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import { derivePaperFillBuildsSource } from "../source-network-policy.js";
import { classifyMavenVersion, parseMavenVersions } from "./maven.js";

export const paperAdapterVersion = "1.0.1";

type PaperFillProject = {
  versions: string[];
};

export type PaperFillBuild = {
  id: string;
  channel: StabilityChannel;
  download: {
    name: string;
    sha256: string;
    size: string;
    url: string;
  };
};

const paperBuildPrefix = "paper-fill-builds:";

function requireRecord(
  value: unknown,
  message: string,
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function requirePaperResource(
  resources: ReadonlyMap<string, FetchedResource>,
  sourceId: "paper-fill-project" | "paper-api-maven-metadata",
): FetchedResource {
  const resource = resources.get(sourceId);
  if (!resource) {
    throw new Error(`paper adapter requires source ${sourceId}`);
  }
  return resource;
}

function isVersion(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    /^[A-Za-z0-9._-]+$/u.test(value)
  );
}

export function parsePaperFillProject(text: string): PaperFillProject {
  const payload = requireRecord(
    JSON.parse(text) as unknown,
    "paper fill project response must be an object",
  );
  const project = requireRecord(
    payload["project"],
    "paper fill project is invalid",
  );
  if (project["id"] !== "paper") {
    throw new Error("paper fill response is not the paper project");
  }
  const versions = requireRecord(
    payload["versions"],
    "paper fill project does not contain versions",
  );
  const flattened: string[] = [];
  for (const [line, values] of Object.entries(versions)) {
    if (!isVersion(line) || !Array.isArray(values) || values.length === 0) {
      throw new Error("paper fill project version line is invalid");
    }
    for (const version of values) {
      if (!isVersion(version)) {
        throw new Error("paper fill project version is invalid");
      }
      flattened.push(version);
    }
  }
  if (flattened.length === 0) {
    throw new Error("paper fill project contains no versions");
  }
  if (new Set(flattened).size !== flattened.length) {
    throw new Error("paper fill project contains duplicate versions");
  }
  return { versions: [...flattened].sort(compareText) };
}

export function derivePaperFillBuildResources(
  resources: ReadonlyMap<string, FetchedResource>,
) {
  const fill = requirePaperResource(resources, "paper-fill-project");
  return parsePaperFillProject(fill.text).versions.map((version) =>
    derivePaperFillBuildsSource(fill.record, version),
  );
}

function buildChannel(value: unknown): StabilityChannel {
  if (typeof value !== "string") {
    return "release";
  }
  switch (value.toLowerCase()) {
    case "release":
    case "stable":
      return "release";
    case "release-candidate":
    case "rc":
      return "release-candidate";
    case "beta":
      return "beta";
    case "alpha":
      return "alpha";
    case "snapshot":
    case "experimental":
      return "snapshot";
    default:
      return "custom";
  }
}

function buildIdentifier(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return value;
  }
  throw new Error("paper Fill build id is invalid");
}

function buildDownload(value: unknown): PaperFillBuild["download"] {
  const downloads = requireRecord(value, "paper Fill downloads are invalid");
  const server = requireRecord(
    downloads["server:default"],
    "paper Fill server download is missing",
  );
  const name = server["name"];
  const size = server["size"];
  const url = server["url"];
  const checksums = requireRecord(
    server["checksums"],
    "paper Fill server checksums are missing",
  );
  const sha256 = checksums["sha256"];
  if (
    typeof name !== "string" ||
    name.length === 0 ||
    name.trim() !== name ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    typeof url !== "string" ||
    !/^[a-f0-9]{64}$/u.test(String(sha256))
  ) {
    throw new Error("paper Fill server download is invalid");
  }
  const checksum = String(sha256);
  const expectedUrl = `https://fill-data.papermc.io/v1/objects/${checksum}/${encodeURIComponent(name)}`;
  if (url !== expectedUrl) {
    throw new Error("paper Fill server download url is invalid");
  }
  return { name, sha256: checksum, size: String(size), url };
}

export function parsePaperFillBuilds(text: string): PaperFillBuild[] {
  const payload = JSON.parse(text) as unknown;
  const candidates = Array.isArray(payload)
    ? payload
    : requireRecord(
        payload,
        "paper Fill builds response must be an array or object",
      )["builds"];
  if (!Array.isArray(candidates)) {
    throw new Error("paper Fill builds response does not contain builds");
  }
  const builds = candidates.map((candidate) => {
    const build = requireRecord(candidate, "paper Fill build is invalid");
    return {
      id: buildIdentifier(build["id"]),
      channel: buildChannel(build["channel"]),
      download: buildDownload(build["downloads"]),
    };
  });
  if (new Set(builds.map((build) => build.id)).size !== builds.length) {
    throw new Error("paper Fill builds response contains duplicate build ids");
  }
  return builds.sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true }),
  );
}

function minecraftKeyFromPaperApi(version: string): string | undefined {
  const match = /^(?:1\.)?\d+\.\d+(?:\.\d+)?/u.exec(version);
  return match?.[0];
}

export function buildPaperSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const fill = requirePaperResource(resources, "paper-fill-project");
  const api = requirePaperResource(resources, "paper-api-maven-metadata");
  const project = parsePaperFillProject(fill.text);
  const buildResources = [...resources.entries()]
    .filter(([key]) => key.startsWith(paperBuildPrefix))
    .sort(([left], [right]) => compareText(left, right));
  const orderedResources = [
    fill,
    api,
    ...buildResources.map(([, resource]) => resource),
  ];
  const buildSourceIndexByMinecraftVersion = new Map(
    buildResources.map(([key], index) => [
      key.slice(paperBuildPrefix.length),
      index + 2,
    ]),
  );
  const publishedMinecraftVersions = new Set(project.versions);
  const entries: SnapshotEntry[] = project.versions.map((version) => ({
    platform: "paper",
    component: "server-release",
    catalogKey: version,
    version,
    coordinate: `paper-fill:paper:${version}`,
    channel: classifyMavenVersion(version),
    sourceIndexes: [0],
  }));
  const rejected: RejectedEntry[] = [];
  for (const minecraftVersion of project.versions) {
    const sourceIndex =
      buildSourceIndexByMinecraftVersion.get(minecraftVersion);
    if (sourceIndex === undefined) {
      rejected.push({
        value: minecraftVersion,
        reason:
          "official Paper Fill build metadata was not captured for this Minecraft version",
        sourceIndex: 0,
      });
      continue;
    }
    const builds = orderedResources[sourceIndex];
    if (!builds) {
      throw new Error("paper adapter build source ordering is incomplete");
    }
    const provenance = builds.record.derivedFrom;
    if (
      builds.record.sourceId !== "paper-fill-builds" ||
      provenance?.sourceId !== "paper-fill-project" ||
      provenance.sha256 !== fill.record.sha256 ||
      provenance.selector !== `version:${minecraftVersion}`
    ) {
      rejected.push({
        value: minecraftVersion,
        reason:
          "captured Paper Fill build metadata does not preserve project provenance",
        sourceIndex,
      });
      continue;
    }
    try {
      for (const build of parsePaperFillBuilds(builds.text)) {
        entries.push({
          platform: "paper",
          component: "paper-server",
          catalogKey: minecraftVersion,
          version: build.id,
          coordinate: `io.papermc.paper:paper:${minecraftVersion}-${build.id}`,
          channel: build.channel,
          sourceIndexes: [0, sourceIndex],
          details: {
            minecraftVersion,
            buildId: build.id,
            downloadName: build.download.name,
            downloadSha256: build.download.sha256,
            downloadSize: build.download.size,
            downloadUrl: build.download.url,
          },
        });
      }
    } catch (error) {
      rejected.push({
        value: minecraftVersion,
        reason: `captured Paper Fill build metadata is invalid, ${error instanceof Error ? error.message : String(error)}`,
        sourceIndex,
      });
    }
  }
  for (const version of parseMavenVersions(api.text)) {
    const catalogKey = minecraftKeyFromPaperApi(version);
    if (!catalogKey || !publishedMinecraftVersions.has(catalogKey)) {
      rejected.push({
        value: version,
        reason:
          "paper api metadata version has no exact Paper Fill Minecraft release evidence",
        sourceIndex: 1,
      });
      continue;
    }
    entries.push({
      platform: "paper",
      component: "paper-api",
      catalogKey,
      version,
      coordinate: `io.papermc.paper:paper-api:${version}`,
      channel: classifyMavenVersion(version),
      sourceIndexes: [0, 1],
    });
  }
  entries.sort(
    (left, right) =>
      compareText(left.catalogKey, right.catalogKey) ||
      compareText(left.component, right.component) ||
      compareText(left.version, right.version) ||
      compareText(left.coordinate, right.coordinate),
  );
  rejected.sort(
    (left, right) =>
      compareText(left.value, right.value) ||
      compareText(left.reason, right.reason),
  );
  const identity = sha256(
    canonicalJson({
      adapter: { id: "paper-fill", version: paperAdapterVersion },
      sources: orderedResources.map((resource) => resource.record.sha256),
    }),
  ).slice(0, 24);
  const warnings = [];
  if (buildResources.length !== project.versions.length) {
    warnings.push(
      "Paper build records are incomplete until every official Paper Fill version response is captured",
    );
  }
  if (rejected.length) {
    warnings.push(
      `${rejected.length} Paper API versions require explicit compatibility review`,
    );
  }
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `paper.${identity}`,
    adapter: { id: "paper-fill", version: paperAdapterVersion },
    createdAt,
    sources: orderedResources.map((resource) => resource.record),
    entries,
    rejected,
    warnings,
  };
}
