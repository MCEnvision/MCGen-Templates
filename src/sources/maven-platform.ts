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

export type MavenComponent = {
  sourceId: string;
  component: string;
  coordinate: string;
  catalogKey: (version: string) => string | undefined;
};

export type MavenPlatformAdapterOptions = {
  id: string;
  version: string;
  platform: string;
  requiredSourceIds: readonly string[];
  components: readonly MavenComponent[];
};

function requireResource(
  resources: ReadonlyMap<string, FetchedResource>,
  sourceId: string,
): FetchedResource {
  const resource = resources.get(sourceId);
  if (!resource) {
    throw new Error(`source adapter requires source ${sourceId}`);
  }
  return resource;
}

export function apiLine(version: string): string | undefined {
  const match = /^(\d+)(?:\.(\d+))?/u.exec(version);
  if (!match) return undefined;
  return match[2] ? `${match[1]}.${match[2]}` : match[1];
}

export function minecraftKey(version: string): string | undefined {
  const match = /^(?:1\.)?\d+\.\d+(?:\.\d+)?/u.exec(version);
  return match?.[0];
}

export function globalKey(): string {
  return "all";
}

export function buildMavenPlatformSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
  options: MavenPlatformAdapterOptions,
): SourceSnapshot {
  const orderedResources = options.requiredSourceIds.map((sourceId) =>
    requireResource(resources, sourceId),
  );
  const sourceIndex = new Map(
    options.requiredSourceIds.map((sourceId, index) => [sourceId, index]),
  );
  const entries: SnapshotEntry[] = [];
  const rejected: RejectedEntry[] = [];
  for (const component of options.components) {
    const resource = requireResource(resources, component.sourceId);
    const index = sourceIndex.get(component.sourceId);
    if (index === undefined) {
      throw new Error(
        `source adapter component ${component.component} is not declared in its source order`,
      );
    }
    for (const version of parseMavenVersions(resource.text)) {
      const catalogKey = component.catalogKey(version);
      if (!catalogKey) {
        rejected.push({
          value: version,
          reason: `${component.component} version does not encode its authoritative catalog key`,
          sourceIndex: index,
        });
        continue;
      }
      entries.push({
        platform: options.platform,
        component: component.component,
        catalogKey,
        version,
        coordinate: `${component.coordinate}:${version}`,
        channel: classifyMavenVersion(version),
        sourceIndexes: [index],
      });
    }
  }
  entries.sort(
    (left, right) =>
      compareText(left.catalogKey, right.catalogKey) ||
      compareText(left.component, right.component) ||
      compareText(left.version, right.version) ||
      compareText(left.coordinate, right.coordinate),
  );
  const componentSourceIds = new Set(
    options.components.map((component) => component.sourceId),
  );
  const corroboratingSourceIds = options.requiredSourceIds.filter(
    (sourceId) => !componentSourceIds.has(sourceId),
  );
  const warnings = [
    ...corroboratingSourceIds.map(
      (sourceId) => `${sourceId} is preserved as corroborating evidence`,
    ),
  ];
  if (rejected.length) {
    warnings.push(
      `${rejected.length} ${options.platform} versions require catalog-key review`,
    );
  }
  const sources = orderedResources.map((resource) => resource.record);
  const identity = sha256(
    canonicalJson({
      adapter: { id: options.id, version: options.version },
      sources: sources.map((source) => source.sha256),
    }),
  ).slice(0, 24);
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `${options.platform}.${identity}`,
    adapter: { id: options.id, version: options.version },
    createdAt,
    sources,
    entries,
    rejected,
    warnings,
  };
}
