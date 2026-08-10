import { canonicalJson, compareText } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type RejectedEntry,
  type SnapshotEntry,
  type SourceSnapshot,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import { classifyMavenVersion, parseMavenVersions } from "./maven.js";

export const paperAdapterVersion = "1.0.0";

type PaperFillProject = {
  versions: string[];
};

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
      sources: [fill.record.sha256, api.record.sha256],
    }),
  ).slice(0, 24);
  const warnings = [
    "Paper build numbers require an immutable capture of each official Paper Fill build response",
  ];
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
    sources: [fill.record, api.record],
    entries,
    rejected,
    warnings,
  };
}
