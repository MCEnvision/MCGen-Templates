import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonicalJson } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  compareReproducibleTrees,
  type ReproducibilityFile,
} from "./reproducibility.js";
import {
  createVerifiedEvidenceRecord,
  createEvidenceRecord,
} from "./evidence.js";
import {
  generateDescriptorFixture,
  type DescriptorFixtureRequest,
} from "./fixture-generator.js";
import {
  nodeCommandExecutor,
  runBuild,
  verifyJavaInstallation,
  type BuildRunRequest,
  type CommandExecutor,
} from "./build-runner.js";
import { inspectArtifact } from "./artifact-inspector.js";
import type {
  ArtifactExpectation,
  ArtifactInspection,
  BuildEvidence,
  BuildRunnerContract,
  TupleEvidenceRecord,
  TupleIdentity,
} from "./phase5-contracts.js";
import type { GeneratedFixture } from "./fixture-generator.js";

export type Phase5ExecutionRequest = {
  tuple: {
    id: string;
    status: "discovered" | "blocked" | "failed" | "queued";
    blockers: readonly string[];
    identity: TupleIdentity;
  };
  fixture: DescriptorFixtureRequest;
  build: BuildRunnerContract;
  artifact: {
    path: string;
    expectation: ArtifactExpectation;
  };
  generatorDigest: string;
  sourceEvidence?: readonly string[];
  parentDirectory: string;
  reviewedProfile: { id: string; digest: string; artifactDigest: string };
  wrapperPath?: string;
  wrapperContent?: Uint8Array;
  execute?: CommandExecutor;
  verifyJava?: () => Promise<void>;
  generatedAt: string;
};

export type Phase5ExecutionResult = {
  evidence: TupleEvidenceRecord;
  firstFixture: GeneratedFixture;
  secondFixture?: GeneratedFixture;
  firstBuild?: BuildEvidence;
  secondBuild?: BuildEvidence;
  firstArtifact?: ArtifactInspection;
  secondArtifact?: ArtifactInspection;
};

function treeFiles(fixture: GeneratedFixture): ReproducibilityFile[] {
  return [...fixture.files.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, content]) => ({
      path,
      sha256: sha256(content),
      bytes: content.byteLength,
    }));
}

function safeArtifactPath(path: string): string {
  if (
    !path ||
    path.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(path) ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "" || part === "." || part === "..")
  )
    throw new Error(`artifact path is not project relative ${path}`);
  return path;
}

async function writeFixture(
  root: string,
  fixture: GeneratedFixture,
): Promise<void> {
  for (const [path, content] of fixture.files) {
    const output = join(root, path);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, content, { flag: "wx" });
  }
}

async function executeOnce(input: {
  request: Phase5ExecutionRequest;
  fixture: GeneratedFixture;
}): Promise<{
  root: string;
  build: BuildEvidence;
  artifact: ArtifactInspection;
}> {
  const root = await mkdtemp(
    join(input.request.parentDirectory, "mcgen-phase5-run-"),
  );
  try {
    const fixtureFiles = new Map(input.fixture.files);
    if (input.request.wrapperPath) {
      const wrapperPath = safeArtifactPath(input.request.wrapperPath);
      if (!input.request.wrapperContent)
        throw new Error("wrapper content is required when wrapperPath is set");
      if (fixtureFiles.has(wrapperPath))
        throw new Error(
          `wrapper path collides with generated fixture ${wrapperPath}`,
        );
      fixtureFiles.set(
        wrapperPath,
        new Uint8Array(input.request.wrapperContent),
      );
    }
    await writeFixture(root, { ...input.fixture, files: fixtureFiles });
    const artifactPath = safeArtifactPath(input.request.artifact.path);
    const absoluteArtifact = join(root, artifactPath);
    const buildRequest: BuildRunRequest = {
      contract: input.request.build,
      workDirectory: root,
      startedAt: input.request.generatedAt,
      execute: input.request.execute ?? nodeCommandExecutor,
      requireExactToolchain: true,
      ...(input.request.wrapperPath
        ? { wrapperPath: join(root, input.request.wrapperPath) }
        : {}),
      verifyJava:
        input.request.verifyJava ??
        (() =>
          verifyJavaInstallation({
            runtime: input.request.build.java.runtime,
            distribution: input.request.build.java.distribution,
          })),
    };
    const build = await runBuild(buildRequest);
    if (build.status !== "passed") {
      return {
        root,
        build,
        artifact: {
          status: "failed",
          path: artifactPath,
          sha256: sha256(new Uint8Array()),
          bytes: 0,
          entries: [],
          metadata: [],
          failures: ["build did not pass, artifact inspection was skipped"],
          warnings: [],
        },
      };
    }
    const artifactBytes = await readFile(absoluteArtifact);
    return {
      root,
      build,
      artifact: inspectArtifact(
        artifactPath,
        artifactBytes,
        input.request.artifact.expectation,
      ),
    };
  } catch (error) {
    return {
      root,
      build: {
        status: "failed",
        startedAt: input.request.generatedAt,
        finishedAt: new Date().toISOString(),
        commands: [],
        failureClass: "environment",
      },
      artifact: {
        status: "failed",
        path: safeArtifactPath(input.request.artifact.path),
        sha256: sha256(new Uint8Array()),
        bytes: 0,
        entries: [],
        metadata: [],
        failures: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      },
    };
  }
}

export async function executeTuple(
  request: Phase5ExecutionRequest,
): Promise<Phase5ExecutionResult> {
  if (request.tuple.status !== "discovered")
    throw new Error("only discovered tuples without blockers may execute");
  if (request.tuple.blockers.length)
    throw new Error("tuple blockers must be resolved before execution");
  if (request.fixture.fixture.rawOverride)
    throw new Error("raw override fixtures are validate only");
  if (
    request.reviewedProfile.digest !==
    request.tuple.identity.contentDigests.profile
  )
    throw new Error("reviewed profile digest does not match tuple identity");
  if (request.reviewedProfile.id !== request.tuple.identity.profileId)
    throw new Error("reviewed profile id does not match tuple identity");
  if (
    request.reviewedProfile.artifactDigest !==
    sha256(canonicalJson(request.artifact.expectation))
  )
    throw new Error("artifact expectation does not match reviewed profile");
  if (
    canonicalJson(request.build.java) !==
    canonicalJson(request.tuple.identity.java)
  )
    throw new Error("build Java runtime does not match tuple identity");
  if (
    canonicalJson(request.build.wrapper) !==
    canonicalJson(request.tuple.identity.wrapper)
  )
    throw new Error("build wrapper does not match tuple identity");
  if (
    request.fixture.spec.fileOperations.some(
      (operation) => operation["trust"] === "custom-unverified",
    )
  )
    throw new Error("custom unverified file operations are never executable");
  if (
    canonicalJson(request.fixture.tuple) !==
    canonicalJson(request.tuple.identity)
  )
    throw new Error("fixture tuple identity is not bound to execution tuple");
  const firstFixture = generateDescriptorFixture(request.fixture);
  const first = await executeOnce({ request, fixture: firstFixture });
  await rm(first.root, { recursive: true, force: true });
  const secondFixture = generateDescriptorFixture(request.fixture);
  const second = await executeOnce({ request, fixture: secondFixture });
  await rm(second.root, { recursive: true, force: true });
  const reproducibility = compareReproducibleTrees(
    treeFiles(firstFixture),
    treeFiles(secondFixture),
  );
  const artifactSame =
    first.artifact.status === "passed" &&
    second.artifact.status === "passed" &&
    first.artifact.sha256 === second.artifact.sha256;
  const reproducible = reproducibility.reproducible && artifactSame;
  const differences = [
    ...reproducibility.differences,
    ...(artifactSame ? [] : ["built artifact bytes differ between runs"]),
  ];
  const evidenceInput = {
    identity: request.tuple.identity,
    generatedAt: request.generatedAt,
    generatorDigest: request.generatorDigest,
    profileRevision: request.tuple.identity.profileRevision,
    descriptorRevision: request.tuple.identity.descriptorRevision,
    build: first.build,
    artifact: first.artifact,
    outputTreeDigest: firstFixture.treeDigest,
    reproducibility: {
      reproducible,
      firstDigest: reproducibility.firstDigest,
      secondDigest: reproducibility.secondDigest,
      differences,
    },
  } as const;
  const evidence =
    first.build.status === "passed" &&
    second.build.status === "passed" &&
    first.artifact.status === "passed" &&
    second.artifact.status === "passed" &&
    reproducible
      ? createVerifiedEvidenceRecord(evidenceInput)
      : createEvidenceRecord({
          ...evidenceInput,
          status: "failed",
          blockers: [
            "exact tuple build, artifact, or reproducibility verification failed",
            ...differences,
          ],
        });
  return {
    evidence,
    firstFixture,
    secondFixture,
    firstBuild: first.build,
    secondBuild: second.build,
    firstArtifact: first.artifact,
    secondArtifact: second.artifact,
  };
}
