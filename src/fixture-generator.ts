import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  renderTemplate,
  renderDescriptor,
  type MetadataTarget,
  type TemplateFile,
} from "./template-renderer.js";
import type { ProjectSpec } from "./project-spec.js";
import { switchProjectMode } from "./project-spec.js";
import {
  fixtureManifestSchema,
  type TupleIdentity,
} from "./phase5-contracts.js";

export type FixtureKind =
  | "minimal-java"
  | "minimal-kotlin"
  | "maximum-structured"
  | "alpha"
  | "beta"
  | "release-candidate"
  | "snapshot"
  | "build-metadata"
  | "custom-png"
  | "optional-features"
  | "raw-override"
  | "multiloader-targets";

export type FixtureDefinition = {
  id: string;
  kind: FixtureKind;
  language: "java" | "kotlin";
  buildSystem?: "gradle" | "maven";
  gradleDsl?: "groovy" | "kotlin";
  version: string;
  rawOverride: boolean;
};

export type FixtureManifest = {
  $schema: typeof fixtureManifestSchema;
  schemaVersion: 1;
  kind: "fixture-manifest";
  tuple: TupleIdentity;
  fixtures: readonly FixtureDefinition[];
  digest: string;
};

export type FixtureManifestInput = {
  tuple: TupleIdentity;
  languages: readonly ("java" | "kotlin")[];
  buildSystems?: readonly ("gradle" | "maven")[];
  gradleDsls?: readonly ("groovy" | "kotlin")[];
  optionalFeatures: readonly string[];
  multiloader: boolean;
};

const orderedKinds: readonly FixtureKind[] = [
  "minimal-java",
  "minimal-kotlin",
  "maximum-structured",
  "alpha",
  "beta",
  "release-candidate",
  "snapshot",
  "build-metadata",
  "custom-png",
  "optional-features",
  "raw-override",
  "multiloader-targets",
];

function versionFor(kind: FixtureKind): string {
  if (kind === "alpha") return "1.0-alpha.1";
  if (kind === "beta") return "1.0-beta.1";
  if (kind === "release-candidate") return "1.0-rc.1";
  if (kind === "snapshot") return "1.0-SNAPSHOT";
  if (kind === "build-metadata") return "1.0.0+build.1";
  return "1.0.0";
}

function fixtureId(
  tuple: TupleIdentity,
  kind: FixtureKind,
  language: string,
  buildSystem: "gradle" | "maven",
  gradleDsl?: "groovy" | "kotlin",
): string {
  return [
    tuple.descriptorId,
    tuple.profileId,
    kind,
    language,
    buildSystem,
    ...(gradleDsl ? [gradleDsl] : []),
  ].join(".");
}

export function fixtureKinds(
  input: FixtureManifestInput,
): readonly FixtureKind[] {
  const kinds = new Set<FixtureKind>([
    "minimal-java",
    "maximum-structured",
    "alpha",
    "beta",
    "release-candidate",
    "snapshot",
    "build-metadata",
    "custom-png",
    "raw-override",
  ]);
  if (input.languages.includes("kotlin")) kinds.add("minimal-kotlin");
  if (input.optionalFeatures.length > 0) kinds.add("optional-features");
  if (input.multiloader) kinds.add("multiloader-targets");
  return orderedKinds.filter((kind) => kinds.has(kind));
}

export function buildFixtureManifest(
  input: FixtureManifestInput,
): FixtureManifest {
  if (input.languages.length === 0)
    throw new Error("fixture manifest requires at least one language");
  const languageValues: readonly string[] = input.languages;
  if (languageValues.some((language) => !["java", "kotlin"].includes(language)))
    throw new Error("fixture manifest language is unsupported");
  const languages: ("java" | "kotlin")[] = [...new Set(input.languages)].sort();
  const buildSystems = [...new Set(input.buildSystems ?? ["gradle"])]
    .sort()
    .map((value) => value as "gradle" | "maven");
  const gradleDsls = [...new Set(input.gradleDsls ?? ["groovy"])]
    .sort()
    .map((value) => value as "groovy" | "kotlin");
  if (buildSystems.length === 0)
    throw new Error("fixture manifest requires at least one build system");
  if (buildSystems.includes("gradle") && gradleDsls.length === 0)
    throw new Error("gradle fixture manifest requires at least one dsl");
  const fixtures = fixtureKinds(input).flatMap((kind) => {
    const supportedLanguages: readonly ("java" | "kotlin")[] =
      kind === "minimal-java" || kind === "minimal-kotlin"
        ? [kind === "minimal-java" ? "java" : "kotlin"]
        : languages;
    return supportedLanguages
      .filter((language) => input.languages.includes(language))
      .flatMap((language) =>
        buildSystems.flatMap((buildSystem) => {
          const dsls: readonly ("groovy" | "kotlin" | undefined)[] =
            buildSystem === "gradle" ? gradleDsls : [undefined];
          return dsls.map((gradleDsl) => ({
            id: fixtureId(input.tuple, kind, language, buildSystem, gradleDsl),
            kind,
            language,
            buildSystem,
            ...(gradleDsl ? { gradleDsl } : {}),
            version: versionFor(kind),
            rawOverride: kind === "raw-override",
          }));
        }),
      );
  });
  const normalizedFixtures = fixtures.sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const withoutDigest = {
    $schema: fixtureManifestSchema,
    schemaVersion: 1 as const,
    kind: "fixture-manifest" as const,
    tuple: structuredClone(input.tuple),
    fixtures: normalizedFixtures,
  };
  return {
    ...withoutDigest,
    digest: sha256(canonicalJson(withoutDigest)),
  };
}

export type GeneratedFixture = {
  fixture: FixtureDefinition;
  files: ReadonlyMap<string, Uint8Array>;
  treeDigest: string;
  warnings: readonly string[];
};

export type DescriptorFixtureRequest = {
  tuple: TupleIdentity;
  fixture: FixtureDefinition;
  descriptorPath: string;
  spec: ProjectSpec;
  repositoryRoot?: string;
  assetBytes?: ReadonlyMap<string, Uint8Array>;
};

export type FixtureRenderRequest = {
  tuple: TupleIdentity;
  fixture: FixtureDefinition;
  descriptorId: string;
  spec: ProjectSpec;
  files: readonly TemplateFile[];
  metadata?: readonly MetadataTarget[];
};

export function fixtureProjectSpec(
  spec: ProjectSpec,
  fixture: FixtureDefinition,
): ProjectSpec {
  let result = structuredClone(spec);
  result.project.version = fixture.version;
  result.template.sourceLanguage = fixture.language;
  result.build.system = fixture.buildSystem ?? result.build.system;
  if (result.build.system === "gradle")
    result.build.gradleDsl =
      fixture.gradleDsl ?? result.build.gradleDsl ?? "groovy";
  else delete result.build.gradleDsl;
  if (fixture.kind === "maximum-structured") {
    result = switchProjectMode(result, "advanced");
    result.metadata = {
      ...result.metadata,
      "phase5.fixture": "maximum-structured",
    };
    result.extensions = {
      ...result.extensions,
      "phase5.fixture": { kind: fixture.kind, language: fixture.language },
    };
    const existingProperties = Array.isArray(result.build["properties"])
      ? result.build["properties"].filter(
          (entry): entry is Record<string, unknown> =>
            entry !== null &&
            typeof entry === "object" &&
            !Array.isArray(entry),
        )
      : [];
    result.build = {
      ...result.build,
      javaLanguage: result.platform.javaLanguage ?? result.platform.java ?? 21,
      properties: [
        ...existingProperties,
        { name: "phase5Fixture", value: fixture.kind },
      ],
    };
  }
  if (fixture.kind === "optional-features") {
    result.features = [
      ...new Set([...result.features, "phase5-optional-features"]),
    ].sort();
  }
  if (fixture.kind === "multiloader-targets") {
    result.targetOverrides = [
      ...result.targetOverrides,
      { id: "phase5-target", platform: result.platform.id },
    ];
  }
  if (fixture.kind === "raw-override") {
    result = switchProjectMode(result, "advanced");
    result.fileOperations = [
      ...result.fileOperations,
      {
        kind: "add",
        path: "phase5/raw-override.txt",
        content: "preserved but never executed",
        trust: "custom-unverified",
      },
    ];
  }
  return result;
}

export function generateFixture(
  request: FixtureRenderRequest,
): GeneratedFixture {
  if (request.fixture.rawOverride && request.spec.mode !== "advanced")
    throw new Error("raw override fixture requires advanced mode");
  const result = renderTemplate({
    descriptorId: request.descriptorId,
    spec: fixtureProjectSpec(request.spec, request.fixture),
    files: request.files,
    ...(request.metadata ? { metadata: request.metadata } : {}),
  });
  return {
    fixture: structuredClone(request.fixture),
    files: result.files,
    treeDigest: result.treeDigest,
    warnings: result.warnings,
  };
}

export function generateDescriptorFixture(
  request: DescriptorFixtureRequest,
): GeneratedFixture {
  if (request.fixture.rawOverride && request.spec.mode !== "advanced")
    throw new Error("raw override fixture requires advanced mode");
  if (request.fixture.kind === "custom-png" && !request.assetBytes?.has("icon"))
    throw new Error("custom png fixture requires the icon asset bytes");
  const result = renderDescriptor(
    request.descriptorPath,
    fixtureProjectSpec(request.spec, request.fixture),
    request.repositoryRoot,
    request.assetBytes,
  );
  return {
    fixture: structuredClone(request.fixture),
    files: result.files,
    treeDigest: result.treeDigest,
    warnings: result.warnings,
  };
}
