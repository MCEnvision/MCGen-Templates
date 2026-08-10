import { canonicalJson, compareText } from "../canonical-json.js";
import {
  sourceSnapshotSchema,
  type FetchedResource,
  type SnapshotEntry,
  type SourceSnapshot,
} from "../contracts.js";
import { sha256 } from "../digest.js";
import { classifyMavenVersion } from "./maven.js";

export const gradleAdapterVersion = "1.0.0";

export type GradleRelease = {
  version: string;
  downloadUrl: string;
  checksumUrl: string;
  checksum: string;
  wrapperChecksumUrl?: string;
  wrapperChecksum?: string;
  released: boolean;
  current: boolean;
  snapshot: boolean;
  nightly: boolean;
  activeRc: boolean;
  broken: boolean;
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

function requireBoolean(value: unknown, message: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(message);
  }
  return value;
}

function requireOfficialUrl(value: unknown, message: string): string {
  const url = requireString(value, message);
  let candidate: URL;
  try {
    candidate = new URL(url);
  } catch {
    throw new Error(message);
  }
  if (
    candidate.protocol !== "https:" ||
    candidate.username ||
    candidate.password ||
    candidate.port ||
    candidate.search ||
    candidate.hash ||
    !["services.gradle.org", "downloads.gradle.org"].includes(
      candidate.hostname,
    )
  ) {
    throw new Error(message);
  }
  return candidate.href;
}

function requireGradleResource(
  resources: ReadonlyMap<string, FetchedResource>,
): FetchedResource {
  const resource = resources.get("gradle-versions");
  if (!resource) {
    throw new Error("gradle adapter requires source gradle-versions");
  }
  return resource;
}

export function parseGradleReleases(text: string): GradleRelease[] {
  const payload = JSON.parse(text) as unknown;
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("gradle versions response must be a nonempty array");
  }
  const releases = payload.map((candidate) => {
    const record = requireRecord(candidate, "gradle release is invalid");
    const wrapperChecksumUrl = record["wrapperChecksumUrl"];
    const wrapperChecksum = record["wrapperChecksum"];
    if (
      (wrapperChecksumUrl === undefined) !==
      (wrapperChecksum === undefined)
    ) {
      throw new Error("gradle release wrapper checksum fields are incomplete");
    }
    const release: GradleRelease = {
      version: requireString(
        record["version"],
        "gradle release version is invalid",
      ),
      downloadUrl: requireOfficialUrl(
        record["downloadUrl"],
        "gradle release download url is invalid",
      ),
      checksumUrl: requireOfficialUrl(
        record["checksumUrl"],
        "gradle release checksum url is invalid",
      ),
      checksum: requireString(
        record["checksum"],
        "gradle release distribution checksum is invalid",
        /^[a-f0-9]{64}$/u,
      ),
      released: requireBoolean(
        record["released"],
        "gradle release state is invalid",
      ),
      current: requireBoolean(
        record["current"],
        "gradle current state is invalid",
      ),
      snapshot: requireBoolean(
        record["snapshot"],
        "gradle snapshot state is invalid",
      ),
      nightly: requireBoolean(
        record["nightly"],
        "gradle nightly state is invalid",
      ),
      activeRc: requireBoolean(
        record["activeRc"],
        "gradle rc state is invalid",
      ),
      broken: requireBoolean(
        record["broken"],
        "gradle broken state is invalid",
      ),
    };
    if (wrapperChecksumUrl !== undefined && wrapperChecksum !== undefined) {
      release.wrapperChecksumUrl = requireOfficialUrl(
        wrapperChecksumUrl,
        "gradle release wrapper checksum url is invalid",
      );
      release.wrapperChecksum = requireString(
        wrapperChecksum,
        "gradle release wrapper checksum is invalid",
        /^[a-f0-9]{64}$/u,
      );
    }
    return release;
  });
  const versions = releases.map((release) => release.version);
  if (new Set(versions).size !== versions.length) {
    throw new Error("gradle versions response contains duplicate versions");
  }
  return [...releases].sort((left, right) =>
    compareText(left.version, right.version),
  );
}

function channelForGradleRelease(
  release: GradleRelease,
): SnapshotEntry["channel"] {
  if (release.snapshot || release.nightly) return "snapshot";
  if (release.activeRc) return "release-candidate";
  return classifyMavenVersion(release.version);
}

export function buildGradleSnapshot(
  resources: ReadonlyMap<string, FetchedResource>,
  createdAt: string,
): SourceSnapshot {
  const versions = requireGradleResource(resources);
  const releases = parseGradleReleases(versions.text);
  const entries: SnapshotEntry[] = releases.map((release) => ({
    platform: "gradle",
    component: "wrapper-distribution",
    catalogKey: "all",
    version: release.version,
    coordinate: `org.gradle:gradle:${release.version}`,
    channel: channelForGradleRelease(release),
    sourceIndexes: [0],
    details: {
      distributionUrl: release.downloadUrl,
      distributionChecksumUrl: release.checksumUrl,
      distributionSha256: release.checksum,
      ...(release.wrapperChecksumUrl && release.wrapperChecksum
        ? {
            wrapperChecksumUrl: release.wrapperChecksumUrl,
            wrapperJarSha256: release.wrapperChecksum,
          }
        : {}),
      released: String(release.released),
      current: String(release.current),
      broken: String(release.broken),
    },
  }));
  const identity = sha256(
    canonicalJson({
      adapter: { id: "gradle-releases", version: gradleAdapterVersion },
      sources: [versions.record.sha256],
    }),
  ).slice(0, 24);
  return {
    $schema: sourceSnapshotSchema,
    schemaVersion: 1,
    provenanceVersion: 1,
    snapshotId: `gradle.${identity}`,
    adapter: { id: "gradle-releases", version: gradleAdapterVersion },
    createdAt,
    sources: [versions.record],
    entries,
    rejected: [],
    warnings: releases.some(
      (release) => !release.wrapperChecksumUrl || !release.wrapperChecksum,
    )
      ? [
          "some historical Gradle releases do not publish an official wrapper checksum",
        ]
      : [],
  };
}
