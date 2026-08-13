import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";

export type ProjectMode = "simple" | "advanced";
export type SourceLanguage = "java" | "kotlin";
export type BuildSystem = "gradle" | "maven";
export type GradleDsl = "groovy" | "kotlin";

export type ProjectSpec = {
  $schema: "urn:mcgen:schema:project-spec:3";
  schemaVersion: 3;
  template: {
    id: string;
    sourceLanguage: SourceLanguage;
  };
  mode: ProjectMode;
  project: {
    name: string;
    id: string;
    package: string;
    mainClass: string;
    version: string;
    groupId?: string;
    artifactId?: string;
    archiveName?: string;
    classifier?: string;
    appendix?: string;
    extension?: string;
    description?: string;
    authors?: string[];
    website?: string;
    license?: string;
  };
  platform: {
    id: string;
    catalogKey: string;
    components: Record<string, string>;
    java?: number;
    javaLanguage?: number;
    loader?: string;
    apiVersion?: string;
    bootstrapper?: string;
    environment?: string;
    mappings?: string;
  };
  metadata: Record<string, unknown>;
  build: Record<string, unknown> & {
    system: BuildSystem;
    gradleDsl?: GradleDsl;
  };
  dependencies: readonly Record<string, unknown>[];
  repositories: readonly Record<string, unknown>[];
  sourceLayout: Record<string, unknown>;
  features: readonly string[];
  assets: readonly Record<string, unknown>[];
  publishing: Record<string, unknown>;
  repository: Record<string, unknown>;
  targetOverrides: readonly Record<string, unknown>[];
  fileOperations: readonly Record<string, unknown>[];
  recommendationLocks?: Readonly<Record<string, boolean>>;
  extensions: Record<string, unknown>;
  dormant?: Record<string, unknown>;
  provenance?: {
    source:
      | "template-default"
      | "catalog"
      | "imported"
      | "session"
      | "structured-override"
      | "raw-override";
    catalogSnapshotId?: string;
    profileId?: string;
    descriptorId?: string;
  };
};

type LegacyProjectSpec = Omit<
  ProjectSpec,
  "$schema" | "schemaVersion" | "template" | "build"
> & {
  $schema: "urn:mcgen:schema:project-spec:1";
  schemaVersion: 1;
  template: string;
  build: Record<string, unknown>;
};

export type ResolvedProjectSpec = {
  spec: ProjectSpec;
  digest: string;
  warnings: string[];
};

const identifierPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const packagePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const classPattern = /^[A-Z][A-Za-z0-9_]*$/;
const versionPattern = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function duplicate(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) =>
    seen.has(value) ? true : (seen.add(value), false),
  );
}

export function validateProjectSpec(value: unknown): string[] {
  const failures: string[] = [];
  const spec = object(value);
  if (!spec) return ["project spec must be an object"];
  if (spec["$schema"] !== "urn:mcgen:schema:project-spec:3")
    failures.push("project spec schema is invalid");
  if (spec["schemaVersion"] !== 3)
    failures.push("project spec version is unsupported");
  const template = object(spec["template"]);
  if (!template || !string(template["id"])?.trim())
    failures.push("template selection is required");
  if (
    template?.["sourceLanguage"] !== "java" &&
    template?.["sourceLanguage"] !== "kotlin"
  )
    failures.push("template source language is invalid");
  if (spec["mode"] !== "simple" && spec["mode"] !== "advanced")
    failures.push("project spec mode is invalid");
  const project = object(spec["project"]);
  if (!project) {
    failures.push("project details are required");
  } else {
    for (const key of [
      "id",
      "name",
      "package",
      "mainClass",
      "version",
    ] as const) {
      if (!string(project[key])?.trim())
        failures.push(`project ${key} is required`);
    }
    const id = string(project["id"]);
    const pkg = string(project["package"]);
    const mainClass = string(project["mainClass"]);
    const version = string(project["version"]);
    if (id && !identifierPattern.test(id))
      failures.push("project id is invalid");
    if (pkg && !packagePattern.test(pkg))
      failures.push("project package is invalid");
    if (mainClass && !classPattern.test(mainClass))
      failures.push("project main class is invalid");
    if (version && (!versionPattern.test(version) || /\s/.test(version)))
      failures.push("project version is invalid");
    if (
      Array.isArray(project["authors"]) &&
      project["authors"].some(
        (author) => typeof author !== "string" || author.length > 256,
      )
    ) {
      failures.push("project authors are invalid");
    }
  }
  const platform = object(spec["platform"]);
  if (!platform || !string(platform["id"]) || !string(platform["catalogKey"]))
    failures.push("platform selection is required");
  const components = platform?.["components"];
  if (!object(components)) failures.push("platform components are required");
  const build = object(spec["build"]);
  if (!build || (build["system"] !== "gradle" && build["system"] !== "maven"))
    failures.push("build system is invalid");
  if (build?.["system"] === "gradle") {
    if (build["gradleDsl"] !== "groovy" && build["gradleDsl"] !== "kotlin")
      failures.push("gradle dsl is invalid");
  } else if (build?.["gradleDsl"] !== undefined) {
    failures.push("gradle dsl is only valid for gradle builds");
  }
  const features = spec["features"];
  if (
    !Array.isArray(features) ||
    features.some(
      (feature) =>
        typeof feature !== "string" || !identifierPattern.test(feature),
    )
  )
    failures.push("features must be identifiers");
  for (const [field, valueToCheck] of [
    ["dependencies", spec["dependencies"]],
    ["repositories", spec["repositories"]],
    ["targetOverrides", spec["targetOverrides"]],
    ["fileOperations", spec["fileOperations"]],
  ] as const) {
    if (
      !Array.isArray(valueToCheck) ||
      valueToCheck.some((entry) => !object(entry))
    )
      failures.push(`${field} must contain objects`);
  }
  const extensions = spec["extensions"];
  if (!object(extensions)) failures.push("extensions object is required");
  const recommendationLocks = spec["recommendationLocks"];
  if (recommendationLocks !== undefined) {
    const locks = object(recommendationLocks);
    if (
      !locks ||
      Object.keys(locks).length > 256 ||
      Object.entries(locks).some(
        ([field, locked]) =>
          !/^[a-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/u.test(field) ||
          field.length > 256 ||
          typeof locked !== "boolean",
      )
    )
      failures.push("recommendation locks are invalid");
  }
  const operations = Array.isArray(spec["fileOperations"])
    ? spec["fileOperations"]
    : [];
  const paths = operations.flatMap((entry) => {
    const item = object(entry);
    const path = string(item?.["path"]);
    const from = string(item?.["from"]);
    return [path, from].filter((candidate): candidate is string =>
      Boolean(candidate),
    );
  });
  const repeated = duplicate(paths);
  if (repeated.length)
    failures.push(`file operation path is duplicated ${repeated[0]}`);
  return failures;
}

export function migrateProjectSpec(value: unknown): ProjectSpec {
  const document = object(value);
  if (!document) throw new Error("project spec must be an object");
  if (
    document["$schema"] === "urn:mcgen:schema:project-spec:3" &&
    document["schemaVersion"] === 3
  ) {
    return structuredClone(document) as ProjectSpec;
  }
  if (
    document["$schema"] !== "urn:mcgen:schema:project-spec:1" ||
    document["schemaVersion"] !== 1
  ) {
    throw new Error("project spec version is unsupported");
  }
  const legacy = structuredClone(document) as LegacyProjectSpec;
  const legacyBuild = object(legacy.build) ?? {};
  const system = legacyBuild["system"] === "maven" ? "maven" : "gradle";
  const legacyDsl = legacyBuild["dsl"];
  const build: ProjectSpec["build"] = {
    ...legacyBuild,
    system,
  };
  delete build["dsl"];
  if (system === "gradle") {
    build.gradleDsl = legacyDsl === "kotlin" ? "kotlin" : "groovy";
  } else {
    delete build.gradleDsl;
  }
  return {
    ...legacy,
    $schema: "urn:mcgen:schema:project-spec:3",
    schemaVersion: 3,
    template: {
      id: legacy.template,
      sourceLanguage: "java",
    },
    build,
    recommendationLocks: legacy.recommendationLocks ?? {},
  };
}

export function switchProjectMode(
  spec: ProjectSpec,
  mode: ProjectMode,
): ProjectSpec {
  if (spec.mode === mode) return structuredClone(spec);
  return {
    ...structuredClone(spec),
    mode,
    dormant: {
      ...(spec.dormant ?? {}),
      ...(mode === "simple"
        ? {
            advanced: spec.build,
            extensions: spec.extensions,
            fileOperations: spec.fileOperations,
          }
        : {}),
    },
  };
}

export function resolveProjectSpec(
  input: ProjectSpec | LegacyProjectSpec,
  warnings: readonly string[] = [],
): ResolvedProjectSpec {
  const spec = migrateProjectSpec(input);
  const failures = validateProjectSpec(spec);
  if (failures.length)
    throw new Error(`project spec validation failed\n${failures.join("\n")}`);
  const resolved = structuredClone(spec);
  resolved.project.groupId ??= resolved.project.package;
  resolved.project.artifactId ??= resolved.project.id;
  resolved.project.archiveName ??= resolved.project.artifactId;
  resolved.project.extension ??= "jar";
  resolved.platform.java ??= resolved.platform.javaLanguage ?? 21;
  resolved.platform.javaLanguage ??= resolved.platform.java;
  resolved.build["javaLanguage"] ??= resolved.platform.javaLanguage;
  return {
    spec: resolved,
    digest: sha256(canonicalJson(resolved)),
    warnings: [...warnings],
  };
}
