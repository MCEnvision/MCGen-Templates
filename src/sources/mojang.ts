type MojangVersion = {
  id?: unknown;
};

type MojangManifest = {
  versions?: unknown;
};

export function parseMojangVersionIds(text: string): string[] {
  const payload = JSON.parse(text) as MojangManifest;
  if (!Array.isArray(payload.versions)) {
    throw new Error("mojang manifest does not contain a versions array");
  }
  const versions = payload.versions
    .map((value) => (value as MojangVersion).id)
    .filter((value): value is string =>
      Boolean(typeof value === "string" && value.trim()),
    );
  if (versions.length === 0) {
    throw new Error("mojang manifest contains no version identifiers");
  }
  return [...new Set(versions)].sort(compareText);
}
import { compareText } from "../canonical-json.js";
