import { compareText } from "./canonical-json.js";

export type FileTree = ReadonlyMap<string, Uint8Array>;

export type FileOperation =
  | {
      kind: "add" | "replace" | "reset";
      path: string;
      content: Uint8Array;
      trust: "canonical" | "custom-unverified";
    }
  | { kind: "delete"; path: string; trust: "canonical" | "custom-unverified" }
  | {
      kind: "rename";
      from: string;
      path: string;
      trust: "canonical" | "custom-unverified";
    };

export type FileChange = {
  path: string;
  kind: "added" | "changed" | "deleted";
  sha256?: string;
};

function pathError(path: string): Error {
  return new Error(`unsafe project path ${path}`);
}

export function normalizeProjectPath(path: string): string {
  if (
    !path ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(path)
  ) {
    throw pathError(path);
  }
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === ".."))
    throw pathError(path);
  return parts.join("/");
}

function clone(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function caseFold(path: string): string {
  return path.toLocaleLowerCase("en-US");
}

export function validateFileTree(tree: FileTree): void {
  const seen = new Set<string>();
  for (const path of tree.keys()) {
    const normalized = normalizeProjectPath(path);
    const folded = caseFold(normalized);
    if (seen.has(folded))
      throw new Error(`case folded project path collision ${path}`);
    seen.add(folded);
  }
}

export function applyFileOperations(
  base: FileTree,
  operations: readonly FileOperation[],
): Map<string, Uint8Array> {
  validateFileTree(base);
  const result = new Map<string, Uint8Array>(
    [...base.entries()].map(([path, value]) => [
      normalizeProjectPath(path),
      clone(value),
    ]),
  );
  for (const operation of operations) {
    if (operation.trust === "custom-unverified" && operation.kind === "reset") {
      throw new Error("custom unverified reset is not allowed");
    }
    const path = normalizeProjectPath(operation.path);
    if (operation.kind === "rename") {
      const from = normalizeProjectPath(operation.from);
      const value = result.get(from);
      if (!value) throw new Error(`rename source does not exist ${from}`);
      if (result.has(path))
        throw new Error(`rename destination already exists ${path}`);
      result.delete(from);
      result.set(path, clone(value));
    } else if (operation.kind === "delete") {
      result.delete(path);
    } else if (operation.kind === "add") {
      if (result.has(path))
        throw new Error(`add destination already exists ${path}`);
      result.set(path, clone(operation.content));
    } else if (operation.kind === "replace") {
      if (!result.has(path))
        throw new Error(`replace target does not exist ${path}`);
      result.set(path, clone(operation.content));
    } else {
      result.set(path, clone(operation.content));
    }
    validateFileTree(result);
  }
  return new Map(
    [...result.entries()].sort(([left], [right]) => compareText(left, right)),
  );
}

export function diffFileTrees(before: FileTree, after: FileTree): FileChange[] {
  validateFileTree(before);
  validateFileTree(after);
  const paths = [
    ...new Set([...before.keys(), ...after.keys()].map(normalizeProjectPath)),
  ].sort(compareText);
  return paths.flatMap<FileChange>((path) => {
    const left = before.get(path);
    const right = after.get(path);
    if (!left && right) return [{ path, kind: "added" as const }];
    if (left && !right) return [{ path, kind: "deleted" as const }];
    if (left && right && !equal(left, right))
      return [{ path, kind: "changed" as const }];
    return [];
  });
}
