import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  evidenceRecordDigest,
  evidenceReusable,
  invalidationReasons,
} from "./evidence.js";
import {
  coverageSummarySchema,
  type TupleEvidenceRecord,
  type VerificationStatus,
} from "./phase5-contracts.js";
import type { MatrixTuple } from "./matrix-planner.js";

export type CoverageSummary = {
  $schema: typeof coverageSummarySchema;
  schemaVersion: 1;
  kind: "coverage-summary";
  catalogSnapshotId: string;
  generatedAt: string;
  matrixDigest: string;
  total: number;
  counts: Readonly<Record<VerificationStatus, number>>;
  byFamily: readonly {
    family: string;
    total: number;
    verified: number;
    legacyVerified: number;
    unresolved: number;
  }[];
  blockers: readonly {
    tupleId: string;
    status: VerificationStatus;
    reasons: readonly string[];
  }[];
  evidenceDigests: readonly string[];
  digest: string;
};

function effectiveStatus(
  tuple: MatrixTuple,
  evidence: TupleEvidenceRecord | undefined,
  generatorDigest: string,
): VerificationStatus {
  if (evidence && evidenceReusable(evidence, tuple.identity, generatorDigest))
    return evidence.status;
  return tuple.status;
}

export function buildCoverageSummary(input: {
  catalogSnapshotId: string;
  generatedAt: string;
  matrixDigest: string;
  tuples: readonly MatrixTuple[];
  evidence: readonly TupleEvidenceRecord[];
  generatorDigest: string;
}): CoverageSummary {
  const byKey = new Map(
    input.evidence.map((record) => [record.key.digest, record]),
  );
  if (byKey.size !== input.evidence.length)
    throw new Error("coverage evidence contains duplicate tuple records");
  const tupleIds = new Set(input.tuples.map((tuple) => tuple.id));
  for (const record of input.evidence)
    if (!tupleIds.has(record.key.digest))
      throw new Error(`coverage evidence is orphaned ${record.key.digest}`);
  const counts: Record<VerificationStatus, number> = {
    verified: 0,
    "legacy-verified": 0,
    discovered: 0,
    blocked: 0,
    failed: 0,
    skipped: 0,
    queued: 0,
  };
  const familyCounts = new Map<
    string,
    {
      total: number;
      verified: number;
      legacyVerified: number;
      unresolved: number;
    }
  >();
  const blockers: CoverageSummary["blockers"][number][] = [];
  for (const tuple of input.tuples) {
    const record = byKey.get(tuple.id);
    const status = effectiveStatus(tuple, record, input.generatorDigest);
    counts[status] += 1;
    const family = familyCounts.get(tuple.identity.family) ?? {
      total: 0,
      verified: 0,
      legacyVerified: 0,
      unresolved: 0,
    };
    family.total += 1;
    if (status === "verified") family.verified += 1;
    if (status === "legacy-verified") family.legacyVerified += 1;
    if (status !== "verified" && status !== "legacy-verified")
      family.unresolved += 1;
    familyCounts.set(tuple.identity.family, family);
    const reusableRecord =
      record && evidenceReusable(record, tuple.identity, input.generatorDigest)
        ? record
        : undefined;
    let reasons: readonly string[];
    if (reusableRecord) {
      reasons = reusableRecord.blockers;
    } else if (record) {
      reasons = invalidationReasons(
        record,
        tuple.identity,
        input.generatorDigest,
      );
    } else {
      reasons = tuple.blockers;
    }
    const normalizedReasons =
      reasons.length || status === "verified" || status === "legacy-verified"
        ? reasons
        : ["tuple has no current verified evidence"];
    if (normalizedReasons.length)
      blockers.push({
        tupleId: tuple.id,
        status,
        reasons: [...normalizedReasons].sort(),
      });
  }
  const byFamily = [...familyCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, values]) => ({ family, ...values }));
  const evidenceDigests = input.evidence
    .filter((record) => {
      const tuple = input.tuples.find(
        (candidate) => candidate.id === record.key.digest,
      );
      return (
        tuple !== undefined &&
        evidenceReusable(record, tuple.identity, input.generatorDigest)
      );
    })
    .map(evidenceRecordDigest)
    .sort();
  const withoutDigest = {
    $schema: coverageSummarySchema,
    schemaVersion: 1 as const,
    kind: "coverage-summary" as const,
    catalogSnapshotId: input.catalogSnapshotId,
    generatedAt: input.generatedAt,
    matrixDigest: input.matrixDigest,
    total: input.tuples.length,
    counts,
    byFamily,
    blockers: blockers.sort((left, right) =>
      left.tupleId.localeCompare(right.tupleId),
    ),
    evidenceDigests,
  };
  return {
    ...withoutDigest,
    digest: sha256(canonicalJson(withoutDigest)),
  };
}
