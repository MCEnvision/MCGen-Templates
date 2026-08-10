import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  evidenceKey,
  tupleEvidenceSchema,
  tupleIdentityDigest,
  type ArtifactInspection,
  type BuildEvidence,
  type TupleEvidenceRecord,
  type TupleIdentity,
} from "./phase5-contracts.js";

export type EvidenceInput = {
  identity: TupleIdentity;
  status: TupleEvidenceRecord["status"];
  generatedAt: string;
  generatorDigest: string;
  profileRevision: number;
  descriptorRevision: number;
  build?: BuildEvidence;
  artifact?: ArtifactInspection;
  outputTreeDigest?: string;
  reproducibility?: TupleEvidenceRecord["reproducibility"];
  blockers?: readonly string[];
};

export type EvidenceValidationOptions = {
  requireBuildAndArtifact?: boolean;
  requireReproducible?: boolean;
};

function sorted(values: readonly string[]): readonly string[] {
  return [...values].sort();
}

export function createEvidenceRecord(
  input: EvidenceInput,
): TupleEvidenceRecord {
  if (input.profileRevision !== input.identity.profileRevision)
    throw new Error("evidence profile revision does not match tuple identity");
  if (input.descriptorRevision !== input.identity.descriptorRevision)
    throw new Error(
      "evidence descriptor revision does not match tuple identity",
    );
  const key = evidenceKey(input.identity);
  return {
    $schema: tupleEvidenceSchema,
    schemaVersion: 1,
    key,
    status: input.status,
    generatedAt: input.generatedAt,
    generatorDigest: input.generatorDigest,
    ...(input.build ? { build: structuredClone(input.build) } : {}),
    ...(input.artifact ? { artifact: structuredClone(input.artifact) } : {}),
    ...(input.outputTreeDigest
      ? { outputTreeDigest: input.outputTreeDigest }
      : {}),
    ...(input.reproducibility
      ? { reproducibility: structuredClone(input.reproducibility) }
      : {}),
    blockers: sorted(input.blockers ?? []),
    invalidation: {
      sourceDigests: sorted(input.identity.sourceDigests),
      profileRevision: input.profileRevision,
      descriptorRevision: input.descriptorRevision,
      wrapperSha256: input.identity.wrapper.sha256,
      ...(input.identity.java.checksum
        ? { javaChecksum: input.identity.java.checksum }
        : {}),
      mappingDigest: input.identity.mappingDigest,
      procedureDigest: input.identity.procedureDigest,
    },
  };
}

export function createVerifiedEvidenceRecord(
  input: Omit<EvidenceInput, "status" | "blockers">,
): TupleEvidenceRecord {
  if (input.build?.status !== "passed")
    throw new Error("verified evidence requires a passed build");
  if (input.artifact?.status !== "passed")
    throw new Error("verified evidence requires a passed artifact inspection");
  if (!input.outputTreeDigest)
    throw new Error("verified evidence requires an output tree digest");
  if (input.reproducibility?.reproducible !== true)
    throw new Error("verified evidence requires reproducible outputs");
  return createEvidenceRecord({
    ...input,
    status: "verified",
    blockers: [],
  });
}

export function evidenceRecordDigest(record: TupleEvidenceRecord): string {
  return sha256(canonicalJson(record));
}

export function evidenceReusable(
  record: TupleEvidenceRecord,
  identity: TupleIdentity,
  generatorDigest: string,
): boolean {
  return (
    (record.status === "verified" || record.status === "legacy-verified") &&
    validateEvidenceRecord(record, { requireBuildAndArtifact: true }).length ===
      0 &&
    record.reproducibility?.reproducible === true &&
    record.key.digest === tupleIdentityDigest(identity) &&
    canonicalJson(record.key.identity) === canonicalJson(identity) &&
    record.generatorDigest === generatorDigest &&
    record.invalidation.wrapperSha256 === identity.wrapper.sha256 &&
    record.invalidation.mappingDigest === identity.mappingDigest &&
    record.invalidation.procedureDigest === identity.procedureDigest &&
    record.invalidation.profileRevision === identity.profileRevision &&
    record.invalidation.descriptorRevision === identity.descriptorRevision &&
    canonicalJson(record.invalidation.sourceDigests) ===
      canonicalJson(sorted(identity.sourceDigests))
  );
}

export function invalidationReasons(
  record: TupleEvidenceRecord,
  identity: TupleIdentity,
  generatorDigest: string,
): readonly string[] {
  const reasons: string[] = [];
  if (record.key.digest !== tupleIdentityDigest(identity))
    reasons.push("tuple identity changed");
  if (record.generatorDigest !== generatorDigest)
    reasons.push("generator changed");
  if (record.invalidation.wrapperSha256 !== identity.wrapper.sha256)
    reasons.push("wrapper changed");
  if (record.invalidation.mappingDigest !== identity.mappingDigest)
    reasons.push("mappings changed");
  if (record.invalidation.procedureDigest !== identity.procedureDigest)
    reasons.push("procedure changed");
  if (record.invalidation.profileRevision !== identity.profileRevision)
    reasons.push("profile revision changed");
  if (record.invalidation.descriptorRevision !== identity.descriptorRevision)
    reasons.push("descriptor revision changed");
  if (
    canonicalJson(record.invalidation.sourceDigests) !==
    canonicalJson(sorted(identity.sourceDigests))
  )
    reasons.push("source evidence changed");
  if (record.invalidation.javaChecksum !== identity.java.checksum)
    reasons.push("java runtime changed");
  return reasons;
}

export function validateEvidenceRecord(
  record: TupleEvidenceRecord,
  options: EvidenceValidationOptions = {},
): string[] {
  const failures: string[] = [];
  if (record.key.digest !== tupleIdentityDigest(record.key.identity))
    failures.push("evidence key digest does not match tuple identity");
  if (
    record.invalidation.profileRevision !== record.key.identity.profileRevision
  )
    failures.push("evidence profile revision does not match tuple identity");
  if (
    record.invalidation.descriptorRevision !==
    record.key.identity.descriptorRevision
  )
    failures.push("evidence descriptor revision does not match tuple identity");
  if (record.invalidation.wrapperSha256 !== record.key.identity.wrapper.sha256)
    failures.push("evidence wrapper checksum does not match tuple identity");
  if (record.invalidation.mappingDigest !== record.key.identity.mappingDigest)
    failures.push("evidence mapping digest does not match tuple identity");
  if (
    record.invalidation.procedureDigest !== record.key.identity.procedureDigest
  )
    failures.push("evidence procedure digest does not match tuple identity");
  if (
    canonicalJson(record.invalidation.sourceDigests) !==
    canonicalJson(sorted(record.key.identity.sourceDigests))
  )
    failures.push("evidence source digests do not match tuple identity");
  if (record.invalidation.javaChecksum !== record.key.identity.java.checksum)
    failures.push("evidence java checksum does not match tuple identity");
  const exactStatus =
    record.status === "verified" || record.status === "legacy-verified";
  if (exactStatus && record.blockers.length > 0)
    failures.push("verified evidence cannot contain blockers");
  if (exactStatus && options.requireBuildAndArtifact) {
    if (record.build?.status !== "passed")
      failures.push("verified evidence requires a passed build");
    if (record.artifact?.status !== "passed")
      failures.push("verified evidence requires a passed artifact inspection");
    if (!record.outputTreeDigest)
      failures.push("verified evidence requires an output tree digest");
    if (
      options.requireReproducible !== false &&
      record.reproducibility?.reproducible !== true
    )
      failures.push("verified evidence requires reproducible outputs");
  }
  if (record.build?.status === "passed" && record.build.failureClass)
    failures.push("passed build evidence cannot have a failure class");
  if (record.artifact?.status === "passed" && record.artifact.failures.length)
    failures.push("passed artifact evidence cannot contain failures");
  return failures;
}
