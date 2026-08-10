import { TextEncoder } from "node:util";
import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  applyFileOperations,
  normalizeProjectPath,
  type FileOperation,
  type FileTree,
} from "./file-operations.js";
import type { ProjectSpec } from "./project-spec.js";

export type TemplateFile = {
  path: string;
  content: string | Uint8Array;
  binary?: boolean;
};

export type MetadataTarget = {
  path: string;
  format: "json" | "properties" | "toml" | "text";
  value: unknown;
};

export type RenderRequest = {
  descriptorId: string;
  spec: ProjectSpec;
  files: readonly TemplateFile[];
  metadata?: readonly MetadataTarget[];
  operations?: readonly FileOperation[];
};

export type RenderResult = {
  descriptorId: string;
  files: Map<string, Uint8Array>;
  treeDigest: string;
  warnings: string[];
};

const encoder = new TextEncoder();

function lookup(spec: ProjectSpec, expression: string): string {
  const path = expression.slice(2, -1).split(".");
  let value: unknown = spec;
  for (const segment of path) {
    if (value === null || typeof value !== "object" || !(segment in value))
      return "";
    value = (value as Record<string, unknown>)[segment];
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  return value === undefined ? "" : canonicalJson(value).trim();
}

function interpolate(value: string, spec: ProjectSpec): string {
  return value.replace(/\$\{[a-zA-Z][a-zA-Z0-9_.-]*\}/g, (expression) =>
    lookup(spec, expression),
  );
}

function properties(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("properties metadata must be an object");
  return `${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${String(item)}`)
    .join("\n")}\n`;
}

function metadataBytes(target: MetadataTarget): Uint8Array {
  if (target.format === "json")
    return encoder.encode(canonicalJson(target.value));
  if (target.format === "properties")
    return encoder.encode(properties(target.value));
  if (target.format === "toml") return encoder.encode(properties(target.value));
  if (typeof target.value !== "string")
    throw new Error("text metadata must be a string");
  return encoder.encode(target.value);
}

function treeDigest(files: FileTree): string {
  const manifest = [...files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, content]) => ({
      path,
      sha256: sha256(content),
      bytes: content.byteLength,
    }));
  return sha256(canonicalJson(manifest));
}

function operationFromSpec(value: Record<string, unknown>): FileOperation {
  const kind = value["kind"];
  const path = value["path"];
  const trust = value["trust"];
  if (
    typeof kind !== "string" ||
    typeof path !== "string" ||
    (trust !== "canonical" && trust !== "custom-unverified")
  )
    throw new Error("file operation is incomplete");
  const contentValue = value["content"];
  const content =
    typeof contentValue === "string" ? encoder.encode(contentValue) : undefined;
  if (kind === "add" || kind === "replace" || kind === "reset") {
    if (!content) throw new Error(`file operation ${kind} needs text content`);
    return { kind, path: normalizeProjectPath(path), content, trust };
  }
  if (kind === "delete")
    return { kind, path: normalizeProjectPath(path), trust };
  if (kind === "rename" && typeof value["from"] === "string")
    return {
      kind,
      from: normalizeProjectPath(value["from"]),
      path: normalizeProjectPath(path),
      trust,
    };
  throw new Error(`unknown file operation ${kind}`);
}

export function renderTemplate(request: RenderRequest): RenderResult {
  const base = new Map<string, Uint8Array>();
  for (const file of request.files) {
    const path = normalizeProjectPath(file.path);
    if (base.has(path)) throw new Error(`template path is duplicated ${path}`);
    const content =
      file.binary && typeof file.content !== "string"
        ? new Uint8Array(file.content)
        : encoder.encode(
            typeof file.content === "string"
              ? interpolate(file.content, request.spec)
              : new TextDecoder().decode(file.content),
          );
    base.set(path, content);
  }
  for (const target of request.metadata ?? []) {
    const path = normalizeProjectPath(target.path);
    if (base.has(path))
      throw new Error(`metadata path collides with template file ${path}`);
    base.set(path, metadataBytes({ ...target, path }));
  }
  const specOperations = request.spec.fileOperations.map((operation) =>
    operationFromSpec(operation),
  );
  const files = applyFileOperations(base, [
    ...(request.operations ?? []),
    ...specOperations,
  ]);
  return {
    descriptorId: request.descriptorId,
    files,
    treeDigest: treeDigest(files),
    warnings:
      request.spec.mode === "advanced"
        ? ["advanced values are preserved and require isolated verification"]
        : [],
  };
}

export function renderMetadata(target: MetadataTarget): Uint8Array {
  return metadataBytes(target);
}
