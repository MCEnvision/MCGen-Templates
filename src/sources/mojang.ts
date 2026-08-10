import { canonicalJson, compareText } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type SnapshotEntry,
  type SourceSnapshot,
  type StabilityChannel,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import { deriveMojangVersionMetadataSource } from "../source-network-policy.js";

export const mojangAdapterVersion = "1.0.0";

export type MojangManifestVersion = {
  id: string;
  type: string;
  url: string;
  sha1: string;
};

type MojangManifest = {
  versions: MojangManifestVersion[];
};

type MojangVersionMetadata = {
  javaVersion: {
    component: string;
    majorVersion: number;
  };
};

export type MojangJavaRequirement = {
  component: string;
  majorVersion: number;
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

function requireString(
  value: unknown,
  message: string,
  pattern?: RegExp,
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    (pattern && !pattern.test(value))
  ) {
    throw new Error(message);
  }
  return value;
}

function requireManifestUrl(id: string, sha1: string, value: unknown): string {
  const url = requireString(value, "mojang manifest version url is invalid");
  const expected = `https://piston-meta.mojang.com/v1/packages/${sha1}/${encodeURIComponent(id)}.json`;
  if (url !== expected) {
    throw new Error(
      "mojang manifest version url does not match its id and sha1",
    );
  }
  return url;
}

function channelFromManifestType(type: string): StabilityChannel {
  switch (type) {
    case "release":
      return "release";
    case "snapshot":
      return "snapshot";
    case "old_beta":
      return "beta";
    case "old_alpha":
      return "alpha";
    default:
      return "custom";
  }
}

function requireMojangResource(
  resources: ReadonlyMap<string, FetchedResource>,
): FetchedResource {
  const resource = resources.get("mojang-version-manifest");
  if (!resource) {
    throw new Error("mojang adapter requires source mojang-version-manifest");
  }
  return resource;
}

export function parseMojangManifest(text: string): MojangManifest {
  const payload = requireRecord(
    JSON.parse(text) as unknown,
    "mojang manifest must be an object",
  );
  if (!Array.isArray(payload["versions"]) || payload["versions"].length === 0) {
    throw new Error("mojang manifest does not contain a versions array");
  }
  const versions = payload["versions"].map((candidate) => {
    const record = requireRecord(
      candidate,
      "mojang manifest version is invalid",
    );
    const id = requireString(
      record["id"],
      "mojang manifest version id is invalid",
      /^[A-Za-z0-9 ._-]+$/u,
    );
    const sha1 = requireString(
      record["sha1"],
      "mojang manifest version sha1 is invalid",
      /^[a-f0-9]{40}$/u,
    );
    return {
      id,
      type: requireString(
        record["type"],
        "mojang manifest version type is invalid",
      ),
      url: requireManifestUrl(id, sha1, record["url"]),
      sha1,
    };
  });
  const ids = versions.map((version) => version.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("mojang manifest contains duplicate version identifiers");
  }
  return {
    versions: [...versions].sort((left, right) =>
      compareText(left.id, right.id),
    ),
  };
}

export function parseMojangVersionIds(text: string): string[] {
  const payload = requireRecord(
    JSON.parse(text) as unknown,
    "mojang manifest must be an object",
  );
  if (!Array.isArray(payload["versions"]) || payload["versions"].length === 0) {
    throw new Error("mojang manifest does not contain a versions array");
  }
  const ids = payload["versions"].map((candidate) =>
    requireString(
      requireRecord(candidate, "mojang manifest version is invalid")["id"],
      "mojang manifest version id is invalid",
      /^[A-Za-z0-9 ._-]+$/u,
    ),
  );
  if (new Set(ids).size !== ids.length) {
    throw new Error("mojang manifest contains duplicate version identifiers");
  }
  return [...ids].sort(compareText);
}

export function parseMojangJavaRequirement(
  text: string,
): MojangJavaRequirement {
  const payload = requireRecord(
    JSON.parse(text) as unknown,
    "mojang version metadata must be an object",
  );
  const javaVersion = requireRecord(
    payload["javaVersion"],
    "mojang version metadata does not declare a javaVersion object",
  ) as MojangVersionMetadata["javaVersion"];
  const component = requireString(
    javaVersion.component,
    "mojang version metadata java component is invalid",
    /^[A-Za-z0-9._-]+$/u,
  );
  if (
    typeof javaVersion.majorVersion !== "number" ||
    !Number.isSafeInteger(javaVersion.majorVersion) ||
    javaVersion.majorVersion < 1 ||
    javaVersion.majorVersion > 99
  ) {
    throw new Error("mojang version metadata java major version is invalid");
  }
  return { component, majorVersion: javaVersion.majorVersion };
}

export function deriveMojangVersionMetadataResources(
  resources: ReadonlyMap<string, FetchedResource>,
) {
  const manifest = requireMojangResource(resources);
  return parseMojangManifest(manifest.text).versions.map((version) =>
    deriveMojangVersionMetadataSource(manifest.record, version),
  );
}

export function buildMojangSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const manifest = requireMojangResource(resources);
  const entries: SnapshotEntry[] = parseMojangManifest(
    manifest.text,
  ).versions.map((version) => ({
    platform: "minecraft",
    component: "game-version",
    catalogKey: version.id,
    version: version.id,
    coordinate: `com.mojang:minecraft:${version.id}`,
    channel: channelFromManifestType(version.type),
    sourceIndexes: [0],
    details: {
      manifestSha1: version.sha1,
      metadataUrl: version.url,
      releaseType: version.type,
    },
  }));
  const identity = sha256(
    canonicalJson({
      adapter: { id: "mojang-version-manifest", version: mojangAdapterVersion },
      sources: [manifest.record.sha256],
    }),
  ).slice(0, 24);
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `mojang.${identity}`,
    adapter: { id: "mojang-version-manifest", version: mojangAdapterVersion },
    createdAt,
    sources: [manifest.record],
    entries,
    rejected: [],
    warnings: [],
  };
}
