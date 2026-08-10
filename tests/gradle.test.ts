import { describe, expect, it } from "vitest";
import { sha256 } from "../src/digest.js";
import type { FetchedResource } from "../src/contracts.js";
import {
  buildGradleSnapshot,
  parseGradleReleases,
} from "../src/sources/gradle.js";

const checksum = "a".repeat(64);

function release(version: string, wrapper = true) {
  return {
    version,
    downloadUrl: `https://services.gradle.org/distributions/gradle-${version}-bin.zip`,
    checksumUrl: `https://services.gradle.org/distributions/gradle-${version}-bin.zip.sha256`,
    checksum,
    ...(wrapper
      ? {
          wrapperChecksumUrl: `https://services.gradle.org/distributions/gradle-${version}-wrapper.jar.sha256`,
          wrapperChecksum: "b".repeat(64),
        }
      : {}),
    released: true,
    current: version === "8.10.2",
    snapshot: false,
    nightly: false,
    activeRc: false,
    broken: false,
  };
}

function resource(text: string): FetchedResource {
  return {
    record: {
      sourceId: "gradle-versions",
      role: "primary",
      requestedUrl: "https://services.gradle.org/versions/all",
      url: "https://services.gradle.org/versions/all",
      redirectChain: ["https://services.gradle.org/versions/all"],
      retrievedAt: "2026-08-10T00:00:00.000Z",
      contentType: "application/json",
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
    },
    text,
  };
}

describe("gradle source adapter", () => {
  it("preserves official distribution and wrapper checksums", () => {
    const source = JSON.stringify([release("8.10.2"), release("0.7", false)]);
    const snapshot = buildGradleSnapshot(
      new Map([["gradle-versions", resource(source)]]),
      "2026-08-10T00:00:00.000Z",
    );
    expect(snapshot.entries).toHaveLength(2);
    expect(snapshot.entries[1]?.details).toMatchObject({
      wrapperJarSha256: "b".repeat(64),
      distributionSha256: checksum,
    });
    expect(snapshot.entries[0]?.details?.["wrapperJarSha256"]).toBeUndefined();
    expect(snapshot.warnings).toContain(
      "some historical Gradle releases do not publish an official wrapper checksum",
    );
  });

  it("rejects a nonofficial distribution url", () => {
    expect(() =>
      parseGradleReleases(
        JSON.stringify([
          {
            ...release("8.10.2"),
            downloadUrl: "https://example.invalid/gradle.zip",
          },
        ]),
      ),
    ).toThrow("gradle release download url is invalid");
  });
});
