import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import { repositoryRoot } from "./schema-registry.js";

export const phase5AuditSchema = "urn:mcgen:schema:phase5-audit:1" as const;

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

async function readObject(path: string): Promise<JsonObject> {
  const value = object(JSON.parse(await readFile(path, "utf8")) as unknown);
  if (!value)
    throw new Error(`phase 5 audit document is not an object ${path}`);
  return value;
}

function blockersFor(document: JsonObject, label: string): string[] {
  if (document["status"] !== "blocked") return [];
  const blockers = Array.isArray(document["blockers"])
    ? document["blockers"]
        .map((entry) => {
          const item = object(entry);
          if (item && typeof item["reason"] === "string") return item["reason"];
          return typeof entry === "string" ? entry : undefined;
        })
        .filter((entry): entry is string => Boolean(entry))
    : [];
  return blockers.length
    ? blockers.map((reason) => `${label}: ${reason}`)
    : [`${label}: blocked document has no explicit blocker`];
}

export type Phase5Audit = {
  $schema: typeof phase5AuditSchema;
  schemaVersion: 1;
  kind: "phase5-audit";
  generatedAt: string;
  status: "candidate" | "blocked" | "verified";
  profiles: { total: number; reviewed: number; blocked: number };
  descriptors: { total: number; reviewed: number; blocked: number };
  evidence: { total: number; verified: number; unresolved: number };
  blockers: readonly string[];
  digest: string;
};

export async function buildPhase5Audit(input: {
  generatedAt: string;
}): Promise<Phase5Audit> {
  const profileNames = (await readdir(join(repositoryRoot, "profiles")))
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .sort();
  const profiles = await Promise.all(
    profileNames.map((name) =>
      readObject(join(repositoryRoot, "profiles", name)),
    ),
  );
  const templateDirectories = (
    await readdir(join(repositoryRoot, "templates"), {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const descriptorPaths: string[] = [];
  for (const directory of templateDirectories) {
    for (const name of [
      "descriptor.json",
      "descriptor-modern.json",
      "descriptor-traditional.json",
      "descriptor-legacy.json",
    ]) {
      const path = join(repositoryRoot, "templates", directory, name);
      try {
        await readFile(path);
        descriptorPaths.push(path);
      } catch (error) {
        if (!(
          error instanceof Error &&
          "code" in error &&
          (error as NodeJS.ErrnoException).code === "ENOENT"
        ))
          throw error;
      }
    }
  }
  const descriptors = await Promise.all(
    descriptorPaths.map((path) => readObject(path)),
  );
  const blockers = [
    ...profiles.flatMap((profile) =>
      blockersFor(
        profile,
        `profile ${typeof profile["id"] === "string" ? profile["id"] : "unknown"}`,
      ),
    ),
    ...descriptors.flatMap((descriptor) =>
      blockersFor(
        descriptor,
        `descriptor ${typeof descriptor["id"] === "string" ? descriptor["id"] : "unknown"}`,
      ),
    ),
  ];
  const evidenceDirectory = join(
    repositoryRoot,
    "verification",
    "phase5",
    "evidence",
  );
  let evidenceNames: string[] = [];
  try {
    evidenceNames = (await readdir(evidenceDirectory))
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ))
      throw error;
  }
  const evidence = await Promise.all(
    evidenceNames.map((name) => readObject(join(evidenceDirectory, name))),
  );
  const verifiedEvidence = evidence.filter(
    (record) =>
      record["status"] === "verified" || record["status"] === "legacy-verified",
  ).length;
  if (verifiedEvidence === 0)
    blockers.push("no reviewed tuple has current build and artifact evidence");
  const profileReviewed = profiles.filter(
    (profile) => profile["status"] === "reviewed",
  ).length;
  const descriptorReviewed = descriptors.filter(
    (descriptor) => descriptor["status"] === "reviewed",
  ).length;
  const unresolved = evidence.length - verifiedEvidence;
  const malformedBlockers = blockers.some((reason) =>
    reason.includes("blocked document has no explicit blocker"),
  );
  const status: Phase5Audit["status"] =
    verifiedEvidence > 0 && unresolved === 0 && !malformedBlockers
      ? "verified"
      : verifiedEvidence > 0
        ? "candidate"
        : "blocked";
  const withoutDigest = {
    $schema: phase5AuditSchema,
    schemaVersion: 1 as const,
    kind: "phase5-audit" as const,
    generatedAt: input.generatedAt,
    status,
    profiles: {
      total: profiles.length,
      reviewed: profileReviewed,
      blocked: profiles.length - profileReviewed,
    },
    descriptors: {
      total: descriptors.length,
      reviewed: descriptorReviewed,
      blocked: descriptors.length - descriptorReviewed,
    },
    evidence: {
      total: evidence.length,
      verified: verifiedEvidence,
      unresolved,
    },
    blockers: [...new Set(blockers)].sort(),
  };
  return { ...withoutDigest, digest: sha256(canonicalJson(withoutDigest)) };
}
