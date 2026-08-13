import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  evidenceKey,
  matrixPlanSchema,
  tupleIdentityDigest,
  type TupleIdentity,
  type VerificationStatus,
} from "./phase5-contracts.js";

export type MatrixSelector = {
  platform: string;
  keys: { mode: "all-shards" | "explicit"; values?: readonly string[] };
  components: readonly {
    component: string;
    coordinatePrefix: string;
    mode: "all-components" | "explicit";
    versions?: readonly string[];
  }[];
};

export type MatrixProfile = {
  id: string;
  revision: number;
  status: "reviewed" | "blocked";
  family: string;
  platform: string;
  catalogSnapshotId: string;
  selectors: readonly MatrixSelector[];
  java: { distribution: string; runtime: number; checksum?: string };
  wrapper: {
    version: string;
    sha256: string;
    kind?: "launcher-script" | "wrapper-jar" | "distribution";
    distributionUrl?: string;
    distributionSha256?: string;
  };
  mappingDigest: string;
  sourceDigests: readonly string[];
  sourceLanguages?: readonly ("java" | "kotlin")[];
  buildSystems?: readonly ("gradle" | "maven")[];
  gradleDsls?: readonly ("groovy" | "kotlin")[];
  contentDigests: {
    profile: string;
    catalog: string;
    template: string;
  };
  blockers?: readonly string[];
};

export type MatrixDescriptor = {
  id: string;
  revision: number;
  status: "reviewed" | "blocked";
  family: string;
  profileRefs: readonly string[];
  contentDigests: { descriptor: string };
  blockers?: readonly string[];
};

export type MatrixPlanInput = {
  catalogKeys: Readonly<Record<string, readonly string[]>>;
  componentVersions: Readonly<
    Record<string, Readonly<Record<string, readonly string[]>>>
  >;
  fixtureIds: readonly string[];
  fixtureDigests?: Readonly<Record<string, string>>;
  /**
   * Optional fixture scope for each descriptor and profile pair. The legacy
   * `fixtureIds` list remains the fallback for callers that plan one shared
   * fixture matrix.
   */
  fixtureIdsByProfile?: Readonly<Record<string, readonly string[]>>;
  profiles: readonly MatrixProfile[];
  descriptors: readonly MatrixDescriptor[];
  compatibility?: readonly {
    platform: string;
    catalogKey: string;
    components: Readonly<Record<string, string>>;
  }[];
  shardCount: number;
  maxTuples: number;
};

export type MatrixTuple = {
  id: string;
  status: VerificationStatus;
  blockers: readonly string[];
  identity: TupleIdentity;
  profileRevision: number;
  descriptorRevision: number;
};

export type MatrixShard = {
  index: number;
  tuples: readonly MatrixTuple[];
  digest: string;
};

export type MatrixPlan = {
  $schema: typeof matrixPlanSchema;
  schemaVersion: 1;
  kind: "matrix-plan";
  shardCount: number;
  tuples: readonly MatrixTuple[];
  shards: readonly MatrixShard[];
  digest: string;
};

function cartesian(
  values: readonly (readonly string[])[],
): readonly (readonly string[])[] {
  return values.reduce<readonly (readonly string[])[]>(
    (current, next) =>
      current.flatMap((prefix) => next.map((value) => [...prefix, value])),
    [[]],
  );
}

function selectorKeys(
  selector: MatrixSelector,
  input: MatrixPlanInput,
): readonly string[] {
  if (selector.keys.mode === "explicit") return selector.keys.values ?? [];
  return input.catalogKeys[selector.platform] ?? [];
}

function selectorComponents(
  selector: MatrixSelector,
  input: MatrixPlanInput,
): readonly (readonly string[])[] {
  return selector.components.map((component) => {
    if (component.mode === "explicit") return component.versions ?? [];
    return (
      input.componentVersions[selector.platform]?.[component.component] ?? []
    ).filter(
      (version) =>
        version.startsWith(component.coordinatePrefix) ||
        component.coordinatePrefix.length === 0,
    );
  });
}

function tupleStatus(
  descriptor: MatrixDescriptor,
  profile: MatrixProfile,
): { status: VerificationStatus; blockers: string[] } {
  const blockers = [
    ...(descriptor.blockers ?? []),
    ...(profile.blockers ?? []),
  ];
  if (descriptor.status === "blocked" || profile.status === "blocked")
    return { status: "blocked", blockers };
  return { status: "discovered", blockers };
}

type FixtureAxes = {
  sourceLanguage: "java" | "kotlin";
  buildSystem: "gradle" | "maven";
  gradleDsl?: "groovy" | "kotlin";
};

function fixtureAxes(fixtureId: string, profile: MatrixProfile): FixtureAxes {
  const parts = fixtureId.split(".");
  const last = parts.at(-1);
  const penultimate = parts.at(-2);
  const antepenultimate = parts.at(-3);
  const isLanguage = (value: string | undefined): value is "java" | "kotlin" =>
    value === "java" || value === "kotlin";
  const isGradleDsl = (
    value: string | undefined,
  ): value is "groovy" | "kotlin" => value === "groovy" || value === "kotlin";

  let sourceLanguage: "java" | "kotlin";
  let buildSystem: "gradle" | "maven";
  let gradleDsl: "groovy" | "kotlin" | undefined;
  if (
    isLanguage(antepenultimate) &&
    penultimate === "gradle" &&
    isGradleDsl(last)
  ) {
    sourceLanguage = antepenultimate;
    buildSystem = "gradle";
    gradleDsl = last;
  } else if (isLanguage(penultimate) && last === "maven") {
    sourceLanguage = penultimate;
    buildSystem = "maven";
  } else if (isLanguage(penultimate) && last === "gradle") {
    sourceLanguage = penultimate;
    buildSystem = "gradle";
    gradleDsl = profile.gradleDsls?.[0] ?? "groovy";
  } else if (isLanguage(last)) {
    sourceLanguage = last;
    buildSystem = profile.buildSystems?.[0] ?? "gradle";
    gradleDsl =
      buildSystem === "gradle"
        ? (profile.gradleDsls?.[0] ?? "groovy")
        : undefined;
  } else {
    sourceLanguage = parts.includes("minimal-kotlin") ? "kotlin" : "java";
    buildSystem = profile.buildSystems?.[0] ?? "gradle";
    gradleDsl =
      buildSystem === "gradle"
        ? (profile.gradleDsls?.[0] ?? "groovy")
        : undefined;
  }

  if (!(profile.sourceLanguages ?? ["java"]).includes(sourceLanguage)) {
    throw new Error(
      `matrix fixture source language is not advertised by profile ${profile.id} ${fixtureId}`,
    );
  }
  if (!(profile.buildSystems ?? ["gradle"]).includes(buildSystem)) {
    throw new Error(
      `matrix fixture build system is not advertised by profile ${profile.id} ${fixtureId}`,
    );
  }
  if (gradleDsl && !(profile.gradleDsls ?? ["groovy"]).includes(gradleDsl)) {
    throw new Error(
      `matrix fixture gradle dsl is not advertised by profile ${profile.id} ${fixtureId}`,
    );
  }
  return {
    sourceLanguage,
    buildSystem,
    ...(gradleDsl ? { gradleDsl } : {}),
  };
}

function tupleWithFixture(
  descriptor: MatrixDescriptor,
  profile: MatrixProfile,
  catalogKey: string,
  components: Readonly<Record<string, string>>,
  fixtureId: string,
  fixtureDigests: Readonly<Record<string, string>> | undefined,
): MatrixTuple {
  const { sourceLanguage, buildSystem, gradleDsl } = fixtureAxes(
    fixtureId,
    profile,
  );
  const identity: TupleIdentity = {
    family: descriptor.family,
    descriptorId: descriptor.id,
    descriptorRevision: descriptor.revision,
    profileId: profile.id,
    profileRevision: profile.revision,
    catalogSnapshotId: profile.catalogSnapshotId,
    catalogKey,
    components,
    fixtureId,
    sourceLanguage,
    buildSystem,
    ...(gradleDsl ? { gradleDsl } : {}),
    contentDigests: {
      descriptor: descriptor.contentDigests.descriptor,
      profile: profile.contentDigests.profile,
      catalog: profile.contentDigests.catalog,
      fixture: fixtureDigests?.[fixtureId] ?? sha256(canonicalJson(fixtureId)),
      template: profile.contentDigests.template,
    },
    java: structuredClone(profile.java),
    wrapper: structuredClone(profile.wrapper),
    mappingDigest: profile.mappingDigest,
    sourceDigests: [...profile.sourceDigests].sort(),
    procedureDigest: sha256(
      canonicalJson({
        descriptor: descriptor.id,
        revision: descriptor.revision,
        profile: profile.id,
        profileRevision: profile.revision,
      }),
    ),
  };
  const { status, blockers } = tupleStatus(descriptor, profile);
  return {
    id: tupleIdentityDigest(identity),
    status,
    blockers,
    identity,
    profileRevision: profile.revision,
    descriptorRevision: descriptor.revision,
  };
}

export function buildMatrixPlan(input: MatrixPlanInput): MatrixPlan {
  if (!Number.isInteger(input.shardCount) || input.shardCount < 1)
    throw new Error("shardCount must be a positive integer");
  if (!Number.isInteger(input.maxTuples) || input.maxTuples < 1)
    throw new Error("maxTuples must be a positive integer");
  if (input.fixtureIds.length === 0)
    throw new Error("matrix requires at least one fixture");
  if (new Set(input.fixtureIds).size !== input.fixtureIds.length)
    throw new Error("matrix fixture ids must be unique");
  const duplicateProfiles = duplicateIds(
    input.profiles.map((profile) => profile.id),
  );
  if (duplicateProfiles.length)
    throw new Error(`matrix profile id is duplicated ${duplicateProfiles[0]}`);
  const duplicateDescriptors = duplicateIds(
    input.descriptors.map((descriptor) => descriptor.id),
  );
  if (duplicateDescriptors.length)
    throw new Error(
      `matrix descriptor id is duplicated ${duplicateDescriptors[0]}`,
    );
  const profiles = new Map(
    input.profiles.map((profile) => [profile.id, profile]),
  );
  const compatibility = input.compatibility ?? [];
  const tuples: MatrixTuple[] = [];
  const seen = new Set<string>();
  for (const descriptor of [...input.descriptors].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    for (const profileId of [...descriptor.profileRefs].sort()) {
      const profile = profiles.get(profileId);
      if (!profile)
        throw new Error(
          `matrix descriptor references missing profile ${profileId}`,
        );
      if (profile.family !== descriptor.family)
        throw new Error(
          `matrix profile family does not match descriptor ${profileId}`,
        );
      for (const selector of profile.selectors) {
        const keys = [...new Set(selectorKeys(selector, input))].sort(
          compareText,
        );
        if (keys.length === 0)
          throw new Error(`matrix selector has no catalog keys ${profile.id}`);
        for (const catalogKey of keys) {
          const componentValues = selectorComponents(selector, input);
          if (componentValues.some((values) => values.length === 0))
            throw new Error(
              `matrix selector has no component versions ${profile.id}`,
            );
          if (componentValues.length !== selector.components.length) continue;
          const combinations = cartesian(componentValues);
          for (const combination of combinations) {
            const components = Object.fromEntries(
              selector.components.map((component, index) => [
                component.component,
                combination[index] ?? "",
              ]),
            );
            if (profile.status === "reviewed") {
              if (compatibility.length === 0)
                throw new Error(
                  `reviewed matrix profile requires explicit compatibility edges ${profile.id}`,
                );
              const allowed = compatibility.some(
                (edge) =>
                  edge.platform === selector.platform &&
                  edge.catalogKey === catalogKey &&
                  canonicalJson(edge.components) === canonicalJson(components),
              );
              if (!allowed) continue;
            }
            const fixtureScope =
              input.fixtureIdsByProfile?.[
                `${descriptor.id}\u0000${profile.id}`
              ] ?? input.fixtureIds;
            for (const fixtureId of [...fixtureScope].sort()) {
              if (
                profile.status === "reviewed" &&
                !input.fixtureDigests?.[fixtureId]
              )
                throw new Error(
                  `reviewed matrix fixture requires an immutable digest ${fixtureId}`,
                );
              const tuple = tupleWithFixture(
                descriptor,
                profile,
                catalogKey,
                components,
                fixtureId,
                input.fixtureDigests,
              );
              if (seen.has(tuple.id)) continue;
              seen.add(tuple.id);
              tuples.push(tuple);
              if (tuples.length > input.maxTuples)
                throw new Error(`matrix exceeds maxTuples ${input.maxTuples}`);
            }
          }
        }
      }
    }
  }
  const sortedTuples = tuples.sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const shards = Array.from({ length: input.shardCount }, (_, index) => {
    const shardTuples = sortedTuples.filter(
      (tuple) =>
        Number.parseInt(tuple.id.slice(0, 8), 16) % input.shardCount === index,
    );
    return {
      index,
      tuples: shardTuples,
      digest: sha256(canonicalJson(shardTuples)),
    };
  });
  const withoutDigest = {
    $schema: matrixPlanSchema,
    schemaVersion: 1 as const,
    kind: "matrix-plan" as const,
    shardCount: input.shardCount,
    tuples: sortedTuples,
    shards,
  };
  return {
    ...withoutDigest,
    digest: sha256(canonicalJson(withoutDigest)),
  };
}

function duplicateIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort(compareText);
}

export function validateMatrixPlan(plan: MatrixPlan): string[] {
  const failures: string[] = [];
  if (!Number.isInteger(plan.shardCount) || plan.shardCount < 1)
    failures.push("matrix shard count is invalid");
  if (plan.shards.length !== plan.shardCount)
    failures.push("matrix shard count does not match shard list");
  const tupleIds = new Set<string>();
  for (const tuple of plan.tuples) {
    if (tuple.id !== tupleIdentityDigest(tuple.identity))
      failures.push(`matrix tuple identity digest is invalid ${tuple.id}`);
    if (tupleIds.has(tuple.id))
      failures.push(`matrix tuple is duplicated ${tuple.id}`);
    tupleIds.add(tuple.id);
  }
  const shardIds = new Set<string>();
  const tuplesById = new Map(plan.tuples.map((tuple) => [tuple.id, tuple]));
  for (const [expectedIndex, shard] of plan.shards.entries()) {
    if (shard.index !== expectedIndex)
      failures.push(`matrix shard index is not contiguous ${shard.index}`);
    const expectedDigest = sha256(canonicalJson(shard.tuples));
    if (shard.digest !== expectedDigest)
      failures.push(`matrix shard digest is invalid ${shard.index}`);
    for (const tuple of shard.tuples) {
      if (!tupleIds.has(tuple.id))
        failures.push(`matrix shard has unknown tuple ${tuple.id}`);
      if (shardIds.has(tuple.id))
        failures.push(`matrix tuple is in multiple shards ${tuple.id}`);
      shardIds.add(tuple.id);
      const topLevelTuple = tuplesById.get(tuple.id);
      if (
        topLevelTuple &&
        canonicalJson(topLevelTuple) !== canonicalJson(tuple)
      )
        failures.push(`matrix shard tuple differs from top level ${tuple.id}`);
      const expectedShard =
        Number.parseInt(tuple.id.slice(0, 8), 16) % plan.shardCount;
      if (expectedShard !== shard.index)
        failures.push(
          `matrix tuple is assigned to the wrong shard ${tuple.id}`,
        );
    }
  }
  for (const tupleId of tupleIds)
    if (!shardIds.has(tupleId))
      failures.push(`matrix tuple is not assigned to a shard ${tupleId}`);
  const withoutDigest = {
    $schema: matrixPlanSchema,
    schemaVersion: 1 as const,
    kind: "matrix-plan" as const,
    shardCount: plan.shardCount,
    tuples: plan.tuples,
    shards: plan.shards,
  };
  if (plan.digest !== sha256(canonicalJson(withoutDigest)))
    failures.push("matrix plan digest is invalid");
  return failures;
}

export function matrixShard(plan: MatrixPlan, index: number): MatrixShard {
  const shard = plan.shards[index];
  if (!shard) throw new Error(`matrix shard ${index} does not exist`);
  return structuredClone(shard);
}

export function matrixEvidenceKey(tuple: MatrixTuple) {
  return evidenceKey(tuple.identity);
}
