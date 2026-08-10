import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";

export type ReproducibilityFile = {
  path: string;
  sha256: string;
  bytes: number;
};

export type ReproducibilityResult = {
  reproducible: boolean;
  firstDigest: string;
  secondDigest: string;
  differences: readonly string[];
};

function normalize(
  files: ReadonlyMap<string, Uint8Array> | readonly ReproducibilityFile[],
): ReproducibilityFile[] {
  const fileList = files as readonly ReproducibilityFile[];
  const values: ReproducibilityFile[] = Array.isArray(files)
    ? [...fileList]
    : [...(files as ReadonlyMap<string, Uint8Array>).entries()].map(
        ([path, content]) => ({
          path,
          sha256: sha256(content),
          bytes: content.byteLength,
        }),
      );
  return values.sort((left, right) => compareText(left.path, right.path));
}

function digest(files: readonly ReproducibilityFile[]): string {
  return sha256(canonicalJson(files));
}

export function compareReproducibleTrees(
  first: ReadonlyMap<string, Uint8Array> | readonly ReproducibilityFile[],
  second: ReadonlyMap<string, Uint8Array> | readonly ReproducibilityFile[],
): ReproducibilityResult {
  const left = normalize(first);
  const right = normalize(second);
  const differences: string[] = [];
  const byPath = new Map(right.map((file) => [file.path, file]));
  for (const file of left) {
    const other = byPath.get(file.path);
    if (!other) differences.push(`missing from second output ${file.path}`);
    else if (file.sha256 !== other.sha256 || file.bytes !== other.bytes)
      differences.push(`content differs ${file.path}`);
    byPath.delete(file.path);
  }
  for (const file of byPath.values())
    differences.push(`missing from first output ${file.path}`);
  return {
    reproducible: differences.length === 0,
    firstDigest: digest(left),
    secondDigest: digest(right),
    differences: differences.sort(compareText),
  };
}
