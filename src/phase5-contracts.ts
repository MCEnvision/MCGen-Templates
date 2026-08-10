import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";

export const fixtureManifestSchema =
  "urn:mcgen:schema:fixture-manifest:1" as const;
export const matrixPlanSchema = "urn:mcgen:schema:matrix-plan:1" as const;
export const tupleEvidenceSchema = "urn:mcgen:schema:tuple-evidence:1" as const;
export const coverageSummarySchema =
  "urn:mcgen:schema:coverage-summary:1" as const;

export type VerificationStatus =
  | "verified"
  | "legacy-verified"
  | "discovered"
  | "blocked"
  | "failed"
  | "skipped"
  | "queued";

export type TupleIdentity = {
  family: string;
  descriptorId: string;
  descriptorRevision: number;
  profileId: string;
  profileRevision: number;
  catalogSnapshotId: string;
  catalogKey: string;
  components: Readonly<Record<string, string>>;
  fixtureId: string;
  contentDigests: {
    descriptor: string;
    profile: string;
    catalog: string;
    fixture: string;
    template: string;
  };
  java: {
    distribution: string;
    runtime: number;
    checksum?: string;
  };
  wrapper: {
    version: string;
    sha256: string;
    kind?: "launcher-script" | "wrapper-jar" | "distribution";
    distributionUrl?: string;
    distributionSha256?: string;
  };
  mappingDigest: string;
  sourceDigests: readonly string[];
  procedureDigest: string;
};

export type EvidenceKey = {
  digest: string;
  identity: TupleIdentity;
};

export type CommandSpec = {
  executable: string;
  args: readonly string[];
  purpose:
    | "format"
    | "static-validation"
    | "unit-tests"
    | "data-generation"
    | "gametests"
    | "build"
    | "package";
};

export type BuildLimits = {
  timeoutMs: number;
  maxOutputBytes: number;
  maxDiskBytes: number;
  retries: number;
  artifactRetentionDays: number;
};

export type BuildRunnerContract = {
  java: TupleIdentity["java"];
  wrapper: TupleIdentity["wrapper"];
  commands: readonly CommandSpec[];
  workDirectoryPolicy: "isolated-clean";
  rawOverridePolicy: "never-execute" | "validate-only";
  limits: BuildLimits;
};

export type ArtifactExpectation = {
  patterns: readonly string[];
  metadataPaths: readonly string[];
  requiredEntries: readonly string[];
  entrypointClasses: readonly string[];
  resourceNamespaces: readonly string[];
  iconPaths: readonly string[];
  expectedExtension: ".jar" | ".zip";
  expectedClassifier?: string;
  publicationCoordinates?: {
    group: string;
    artifact: string;
    version: string;
  };
  projectIdentity?: {
    id: string;
    name?: string;
    version: string;
  };
  metadataFields?: Readonly<Record<string, string>>;
  iconReferences?: readonly {
    metadataPath: string;
    iconPath: string;
  }[];
  maxEntries?: number;
};

export type ArtifactInspection = {
  status: "passed" | "failed";
  path: string;
  sha256: string;
  bytes: number;
  entries: readonly string[];
  metadata: readonly {
    path: string;
    format: "json" | "properties" | "toml" | "text" | "unknown";
    valid: boolean;
    values: Readonly<Record<string, string>>;
  }[];
  failures: readonly string[];
  warnings: readonly string[];
};

export type BuildEvidence = {
  status: "passed" | "failed" | "blocked" | "skipped";
  startedAt: string;
  finishedAt: string;
  commands: readonly {
    command: readonly string[];
    exitCode: number | null;
    durationMs: number;
    outputDigest: string;
    outputBytes?: number;
    diskBytes?: number;
  }[];
  failureClass?: "deterministic" | "transient" | "policy" | "environment";
};

export type TupleEvidenceRecord = {
  $schema: typeof tupleEvidenceSchema;
  schemaVersion: 1;
  key: EvidenceKey;
  status: VerificationStatus;
  generatedAt: string;
  generatorDigest: string;
  build?: BuildEvidence;
  artifact?: ArtifactInspection;
  outputTreeDigest?: string;
  reproducibility?: {
    reproducible: boolean;
    firstDigest: string;
    secondDigest: string;
    differences: readonly string[];
  };
  blockers: readonly string[];
  invalidation: {
    sourceDigests: readonly string[];
    contentDigests: TupleIdentity["contentDigests"];
    profileRevision: number;
    descriptorRevision: number;
    wrapperSha256: string;
    javaChecksum?: string;
    mappingDigest: string;
    procedureDigest: string;
  };
};

export function tupleIdentityDigest(identity: TupleIdentity): string {
  return sha256(canonicalJson(identity));
}

export function evidenceKey(identity: TupleIdentity): EvidenceKey {
  return {
    digest: tupleIdentityDigest(identity),
    identity: structuredClone(identity),
  };
}

export function validateBuildLimits(limits: BuildLimits): string[] {
  const failures: string[] = [];
  if (!Number.isInteger(limits.timeoutMs) || limits.timeoutMs < 1_000)
    failures.push("timeoutMs must be at least 1000");
  if (limits.timeoutMs > 3_600_000)
    failures.push("timeoutMs must not exceed one hour");
  if (!Number.isInteger(limits.maxOutputBytes) || limits.maxOutputBytes < 1_024)
    failures.push("maxOutputBytes must be at least 1024");
  if (limits.maxOutputBytes > 64 * 1024 * 1024)
    failures.push("maxOutputBytes must not exceed 64 MiB");
  if (!Number.isInteger(limits.maxDiskBytes) || limits.maxDiskBytes < 1_024)
    failures.push("maxDiskBytes must be at least 1024");
  if (limits.maxDiskBytes > 4 * 1024 * 1024 * 1024)
    failures.push("maxDiskBytes must not exceed 4 GiB");
  if (
    !Number.isInteger(limits.retries) ||
    limits.retries < 0 ||
    limits.retries > 3
  )
    failures.push("retries must be between 0 and 3");
  if (
    !Number.isInteger(limits.artifactRetentionDays) ||
    limits.artifactRetentionDays < 1 ||
    limits.artifactRetentionDays > 30
  )
    failures.push("artifactRetentionDays must be between 1 and 30");
  return failures;
}

export function validateSha256(value: string, label: string): string[] {
  return /^[a-f0-9]{64}$/u.test(value)
    ? []
    : [`${label} must be a lowercase sha256 digest`];
}

export function validateBuildContract(contract: BuildRunnerContract): string[] {
  const failures = validateBuildLimits(contract.limits);
  if (contract.rawOverridePolicy !== "never-execute")
    failures.push("raw overrides must never execute in canonical builds");
  if (contract.commands.length === 0)
    failures.push("build commands are required");
  const unsafe = /[;&|`$<>\n\r]/u;
  for (const command of contract.commands) {
    if (
      !command.executable ||
      unsafe.test(command.executable) ||
      command.executable.startsWith("/") ||
      command.executable.includes("\\") ||
      command.executable.split("/").some((part) => part === "..")
    )
      failures.push(`unsafe executable for ${command.purpose}`);
    if (
      /^[/\\]/u.test(command.executable) ||
      /^[A-Za-z]:[\\/]/u.test(command.executable) ||
      /(?:^|[/\\])\.\.(?:[/\\]|$)/u.test(command.executable)
    )
      failures.push(`executable must be workspace relative ${command.purpose}`);
    if (command.args.some((arg) => unsafe.test(arg)))
      failures.push(`unsafe argument for ${command.purpose}`);
  }
  failures.push(...validateSha256(contract.wrapper.sha256, "wrapper checksum"));
  if (contract.java.checksum)
    failures.push(...validateSha256(contract.java.checksum, "java checksum"));
  if (!Number.isInteger(contract.java.runtime) || contract.java.runtime < 6)
    failures.push("java runtime is invalid");
  return failures;
}
