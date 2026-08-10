import { describe, expect, it } from "vitest";
import {
  classifyMavenVersion,
  parseMavenVersions,
} from "../src/sources/maven.js";

describe("maven metadata parser", () => {
  it("returns exact versions in deterministic order", () => {
    expect(
      parseMavenVersions(`
        <metadata><versioning><versions>
          <version>2.0.0</version><version>1.0.0</version>
        </versions></versioning></metadata>
      `),
    ).toEqual(["1.0.0", "2.0.0"]);
  });

  it.each([
    ["<metadata />", "maven metadata contains no versions"],
    [
      "<metadata><versioning><versions><version>1.0</version><version>1.0</version></versions></versioning></metadata>",
      "maven metadata contains duplicate versions",
    ],
    ["<metadata><versioning>", "maven metadata is malformed"],
  ])("rejects malformed metadata", (xml, message) => {
    expect(() => parseMavenVersions(xml)).toThrow(message);
  });

  it.each([
    ["1.0.0", "release"],
    ["1.0.0-rc.1", "release-candidate"],
    ["1.0.0-beta.1", "beta"],
    ["1.0.0-alpha.1", "alpha"],
    ["1.0.0-SNAPSHOT", "snapshot"],
  ] as const)("classifies %s", (version, channel) => {
    expect(classifyMavenVersion(version)).toBe(channel);
  });
});
