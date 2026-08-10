# Phase 5 Build and Artifact Contracts

Phase 5 is complete on `main` and identified by the verified signed tag `phase-5-build-verification`. It proves exact generated project tuples. The implementation provides deterministic fixture and matrix planning, isolated bounded command execution, real zip artifact parsing, reproducibility comparison, exact evidence invalidation, public coverage summaries, and queue plans. The reviewed Spigot modern tuple for Minecraft 1.21.1 and the reviewed Spigot legacy tuple for Minecraft 1.8.8 each have current build, artifact, and reproducibility evidence. Other boundaries remain explicitly blocked until their own exact evidence exists.

## Exact tuple identity

Every matrix tuple includes the family, descriptor revision, profile revision, catalog snapshot and key, exact component coordinates, fixture, Java distribution and runtime, wrapper version and checksum, mapping digest, source evidence digests, and verification procedure digest. The canonical JSON digest of that identity is the evidence key. A changed source snapshot, profile, descriptor, mapping, wrapper, Java checksum, generator, or procedure produces a new key or invalidates the previous record.

## Fixture manifests

`src/fixture-generator.ts` produces stable fixture manifests for each tuple. The matrix includes minimal Java, minimal Kotlin when supported, maximum structured customization, alpha, beta, release candidate, snapshot, build metadata, custom PNG, optional feature, raw override, and multiloader target cases where applicable. Raw override fixtures are preserved as input and are never executable.

## Matrix planning

`src/matrix-planner.ts` expands only explicit catalog keys and component versions supplied by the caller. All shard assignment is deterministic from the exact tuple digest. Blocked profiles and descriptors remain blocked with their reasons. The planner never promotes a discovered tuple to Verified and has a bounded tuple count and shard count.

## Build runner

`src/build-runner.ts` models the exact profile commands and limits. Commands are passed as executable and argument arrays, never as a shell string. Canonical builds require an isolated clean directory, a pinned wrapper checksum, bounded output, bounded disk and time limits, bounded retries, and the `never-execute` raw override policy. A runner receives an injected executor so the contract can be tested without executing repository content.

## Artifact inspection

`src/artifact-inspector.ts` checks artifact naming, required entries, metadata syntax and identity values, entrypoint classes, resource namespaces, PNG icons, duplicate and unsafe paths, local build output, logs, caches, and obvious credentials. The report stores only digests and bounded summaries suitable for public coverage output.

## Evidence and coverage

`src/evidence.ts` creates exact tuple evidence and checks reuse against every invalidation input. `src/coverage-summary.ts` creates a public summary with status counts, family coverage, blockers, matrix digest, and evidence digests without exposing local paths or secret material. Evidence records are reusable only when their complete content addressed key and generator digest match.

## Verification commands

Run the normal repository gate after changing these contracts.

```text
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
```

Profile and descriptor records that do not yet have exact catalog and toolchain evidence remain explicitly blocked or discovered. The Phase 5 implementation must never turn a discovered value or a synthetic test into Verified status.

The available deterministic commands are:

```bash
npm run phase5:fixture -- --input verification/phase5/fixture-input.json --output verification/phase5/fixture-manifest.json
npm run phase5:matrix -- --input verification/phase5/matrix-input.json --output verification/phase5/matrix-plan.json
npm run phase5:evidence -- --input verification/phase5/tuple-evidence.json
npm run phase5:coverage -- --input verification/phase5/coverage-input.json --output verification/phase5/coverage-summary.json
npm run phase5:queue -- --input verification/phase5/queue-event.json --output verification/phase5/queue-plan.json --shard-count 4 --shard-index 0
npm run phase5:execute -- --input verification/phase5/execution-input.json --output verification/phase5/tuple-evidence.json
npm run phase5:execute-reviewed -- --input-dir verification/phase5/executions/ --output-dir verification/phase5/evidence/
npm run phase5:audit -- --generated-at 2000-01-01T00:00:00.000Z --output verification/phase5/audit.json
```

The input documents are reviewed repository data, not user supplied shell commands. Raw Advanced build overrides remain validate only and are never passed to the executor.

`phase5 execute` renders a descriptor fixture into a clean temporary workspace, runs only an unblocked discovered tuple with its declared bounded command contract, inspects the declared artifact, repeats the generation and build, compares both output trees and artifact digests, and writes one schema validated evidence record. It refuses blocked tuples, unresolved blockers, and raw override fixtures. The command must be supplied with a reviewed wrapper file and exact artifact expectation when the selected profile requires them.

The thin `phase 5 tuple verification` workflow runs the deterministic contract gate on boundary changes, main updates, and the weekly scheduled audit. `phase5-queue.ts` keeps changed boundaries, new tuples, invalidation, scheduled audits, and transient recovery as separate bounded queues with deterministic shard assignment and cancellation keys. Real tuple execution remains limited to profiles with reviewed exact commands and complete upstream evidence.

The audit command inventories every profile and descriptor, requires an explicit blocker for each blocked record, counts current evidence, and reports verified when at least one reviewed tuple has current build and artifact evidence and no evidence record is unresolved. Disclosed blockers for other boundaries remain in the report and do not imply support. The reviewed execution batch only reads schema validated inputs under `verification/phase5/executions/`, resolves the profile command and artifact contract from a reviewed profile, and writes evidence under `verification/phase5/evidence/`. It never executes raw Advanced file operations.

The test suite also runs a real generated Bukkit smoke project through `javac` and `jar`, inspects its `plugin.yml` and entrypoint class, and repeats the package with fixed archive timestamps. This verifies the execution engine itself without promoting that synthetic smoke identity to a catalog profile. The committed Spigot evidence goes further. It uses the exact published API coordinates, pinned Gradle launcher script and distribution checksum, Temurin 21 or 8, generated plugin metadata and entrypoint, Gradle compilation and tests, artifact inspection, and two isolated reproducible runs.

## Committed reviewed evidence

The reviewed modern boundary is [Spigot 1.21.1](../../profiles/spigot-modern.json) with [its descriptor](../../templates/spigot/descriptor-modern.json). The reviewed historical boundary is [Spigot 1.8.8](../../profiles/spigot-legacy.json) with [its descriptor](../../templates/spigot/descriptor-legacy.json). Their exact execution records are [modern evidence](../../verification/phase5/evidence/spigot-modern.json) and [legacy evidence](../../verification/phase5/evidence/spigot-legacy.json). The generated [coverage summary](../../verification/phase5/coverage.json) reports two verified tuples with no unresolved coverage, while the [audit report](../../verification/phase5/audit.json) records the remaining twelve profile and descriptor blockers explicitly.
