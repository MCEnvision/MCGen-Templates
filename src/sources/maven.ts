import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { compareText } from "../canonical-json.js";
import type { StabilityChannel } from "../contracts.js";

type MavenMetadata = {
  metadata?: {
    versioning?: {
      versions?: {
        version?: unknown;
      };
    };
  };
};

export function parseMavenVersions(xml: string): string[] {
  try {
    SyntaxValidator.validate(xml);
  } catch (error) {
    throw new Error("maven metadata is malformed", { cause: error });
  }
  const parser = new XMLParser({
    allowBooleanAttributes: false,
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });
  const document = parser.parse(xml) as MavenMetadata;
  const value = document.metadata?.versioning?.versions?.version;
  const values = Array.isArray(value) ? value : [value];
  const versions = values.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0,
  );
  if (versions.length === 0) {
    throw new Error("maven metadata contains no versions");
  }
  if (new Set(versions).size !== versions.length) {
    throw new Error("maven metadata contains duplicate versions");
  }
  return [...versions].sort(compareText);
}

export function classifyMavenVersion(version: string): StabilityChannel {
  const normalized = version.toLowerCase();
  if (normalized.includes("snapshot") || normalized.includes("weekly")) {
    return "snapshot";
  }
  if (
    normalized.includes("alpha") ||
    /(?:^|[-_.])a\d+(?:[-_.]|$)/u.test(normalized)
  ) {
    return "alpha";
  }
  if (
    normalized.includes("beta") ||
    /(?:^|[-_.])b\d+(?:[-_.]|$)/u.test(normalized)
  ) {
    return "beta";
  }
  if (
    normalized.includes("prerelease") ||
    normalized.includes("candidate") ||
    /(?:^|[_-])pre[0-9]+/u.test(normalized) ||
    /(?:^|[-_.])rc(?:[-_.0-9]|$)/u.test(normalized)
  ) {
    return "release-candidate";
  }
  return "release";
}
