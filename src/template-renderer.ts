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
  format:
    | "json"
    | "properties"
    | "toml"
    | "yaml"
    | "gradle"
    | "xml"
    | "text"
    | "binary";
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
  if (expression === "${project.packagePath}") {
    return spec.project.package.replaceAll(".", "/");
  }
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

function scalar(value: unknown, format: "toml" | "yaml"): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error(`${format} value is not finite`);
    return String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (value === null) {
    if (format === "yaml") return "null";
    throw new Error("toml does not support null values");
  }
  throw new Error(`${format} value must be scalar`);
}

function properties(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("properties metadata must be an object");
  return `${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => {
      if (item !== null && typeof item === "object") {
        return `${key}=${canonicalJson(item)}`;
      }
      return `${key}=${String(item)}`;
    })
    .join("\n")}\n`;
}

function tomlKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function tomlValue(value: unknown): string {
  if (Array.isArray(value)) {
    if (value.some((item) => item !== null && typeof item === "object")) {
      throw new Error("toml arrays of tables must be represented as objects");
    }
    return `[${value.map((item) => scalar(item, "toml")).join(", ")}]`;
  }
  return scalar(value, "toml");
}

function toml(value: unknown, prefix = ""): string {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("toml metadata must be an object");
  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right),
  );
  const lines: string[] = [];
  const nested: [string, Record<string, unknown>][] = [];
  for (const [key, item] of entries) {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      nested.push([key, item as Record<string, unknown>]);
      continue;
    }
    lines.push(`${tomlKey(key)} = ${tomlValue(item)}`);
  }
  for (const [key, item] of nested) {
    if (lines.length > 0) lines.push("");
    const section = prefix ? `${prefix}.${key}` : key;
    lines.push(`[${section.split(".").map(tomlKey).join(".")}]`);
    lines.push(toml(item, section).trimEnd());
  }
  return `${lines.filter((line, index) => line || index === 0).join("\n")}\n`;
}

function yamlScalar(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean")
    return scalar(value, "yaml");
  throw new Error("yaml value must be scalar");
}

function yaml(value: unknown, indent = 0): string {
  const padding = " ".repeat(indent);
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item !== null && typeof item === "object") {
          const nested = yaml(item, indent + 2).trimStart();
          return `${padding}- ${nested.replaceAll(`\n${" ".repeat(indent + 2)}`, `\n${" ".repeat(indent + 2)}  `)}`;
        }
        return `${padding}- ${yamlScalar(item)}`;
      })
      .join("\n");
  }
  if (value === null || typeof value !== "object")
    return `${padding}${yamlScalar(value)}`;
  return Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => {
      if (item !== null && typeof item === "object") {
        return `${padding}${key}:\n${yaml(item, indent + 2)}`;
      }
      return `${padding}${key}: ${yamlScalar(item)}`;
    })
    .join("\n");
}

function metadataBytes(target: MetadataTarget): Uint8Array {
  switch (target.format) {
    case "json":
      return encoder.encode(canonicalJson(target.value));
    case "properties":
      return encoder.encode(properties(target.value));
    case "toml":
      return encoder.encode(toml(target.value));
    case "yaml":
      return encoder.encode(`${yaml(target.value)}\n`);
    case "binary":
      if (!(target.value instanceof Uint8Array))
        throw new Error("binary metadata must be bytes");
      return new Uint8Array(target.value);
    case "gradle":
    case "xml":
    case "text":
      if (typeof target.value !== "string")
        throw new Error("text metadata must be text");
      return encoder.encode(target.value);
    default:
      throw new Error("unsupported metadata format");
  }
}

function interpolateValue(value: unknown, spec: ProjectSpec): unknown {
  if (typeof value === "string") return interpolate(value, spec);
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (Array.isArray(value))
    return value.map((item) => interpolateValue(item, spec));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        interpolateValue(item, spec),
      ]),
    );
  }
  return value;
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
  const encoding = value["encoding"];
  let content: Uint8Array | undefined;
  if (typeof contentValue === "string") {
    if (encoding === undefined || encoding === "utf8") {
      content = encoder.encode(contentValue);
    } else if (encoding === "base64") {
      if (
        contentValue.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
          contentValue,
        )
      ) {
        throw new Error("file operation base64 content is invalid");
      }
      content = new Uint8Array(Buffer.from(contentValue, "base64"));
    } else {
      throw new Error("file operation encoding is invalid");
    }
  }
  if (kind === "add" || kind === "replace" || kind === "reset") {
    if (!content) throw new Error(`file operation ${kind} needs text content`);
    return { kind, path: normalizeProjectPath(path), content, trust };
  }
  if (kind === "diff") return { kind, path: normalizeProjectPath(path), trust };
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
    const path = normalizeProjectPath(interpolate(file.path, request.spec));
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
    base.set(
      path,
      metadataBytes({
        ...target,
        path,
        value: interpolateValue(target.value, request.spec),
      }),
    );
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

export function renderMetadata(
  target: MetadataTarget,
  spec?: ProjectSpec,
): Uint8Array {
  return metadataBytes({
    ...target,
    value: spec ? interpolateValue(target.value, spec) : target.value,
  });
}
