# MCGen Templates GitHub Completion Plan

## Purpose

This plan defines the complete GitHub work required to make `MCEnvision/MCGen-Templates` the authoritative, verifiable, maintainable, and releasable source for every supported MCGen template family and compatibility tuple.

The plan has seven main phases. Each phase includes repository content, GitHub configuration, planning state, automated verification, documentation, and completion evidence. A phase is complete only after its pull request is merged through GitHub, required checks pass on `main`, the merged commit is verified, canonical documentation is updated, and the signed annotated phase tag is published.

This document is subordinate to the owner request and the [complete project plan](plan.md). It provides a focused execution plan for GitHub and the template pack repository.

## Scope

The completed repository will support:

1. Forge across every Minecraft version and exact official Forge artifact discoverable from authoritative metadata.
2. NeoForge across every official versioning convention and exact official artifact.
3. Fabric game versions, loader versions, mappings, Fabric API, Loom, installers, and language adapters.
4. Architectury and configurable Fabric, Forge, and NeoForge multiloader intersections.
5. Bukkit, Spigot, Paper, and Sponge plugin projects.
6. Velocity and BungeeCord proxy projects.
7. Java, Kotlin, Gradle, Maven where required, build plugins, mappings, wrappers, metadata formats, and platform specific toolchain boundaries.
8. Simple mode defaults and complete Advanced mode customization contracts.
9. Project versions including alpha, beta, release candidate, snapshot, build metadata, and valid free form versions.
10. Complete metadata, PNG icon slots, dependencies, repositories, source layouts, run profiles, Gradle properties, publishing settings, target overrides, and raw file operations.
11. Deterministic minimal and maximum customization fixtures.
12. Compilation, packaging, metadata, entrypoint, asset, and artifact verification for every tuple labeled verified.
13. Public coverage reports that disclose every discovered tuple and every unresolved blocker without silent omissions.
14. Immutable, signed, content addressed template pack releases.
15. Automated upstream monitoring, safe additive reconciliation, and maintenance pull requests.

## Explicitly Deferred Work

The following work remains in the future `MCEnvision/MCGen` application repository and is not required to complete this plan:

1. GitHub App registration, authentication, installation tokens, webhook processing, and destination repository writes.
2. The website and browser editor.
3. The public API and generator service.
4. The standalone user facing CLI and reusable generator library.
5. Nginx, Cloudflare Tunnel, DNS, production hosting, and production deployment.

This repository may define stable contracts consumed by those components. It does not implement or deploy them.

## Current Baseline

As of August 9, 2026:

1. The public repository exists at `MCEnvision/MCGen-Templates`.
2. The initial GitHub foundation is merged and signed.
3. Pull request only integration, merge commits, resolved conversations, direct update blocking, force push blocking, and deletion blocking are configured.
4. Quality checks, CodeQL, credential scanning, Dependabot, issue forms, CODEOWNERS, labels, milestones, the roadmap Project, environments, wiki navigation, and immutable release controls are configured where supported.
5. Versioned source, snapshot, catalog, profile, descriptor, coverage, and pack contracts exist.
6. Secure source fetching and one immutable Forge discovery snapshot exist on `main`.
7. No complete compatibility catalog, toolchain profile set, template family set, generated project matrix, or pack release exists yet.
8. Issue `1` tracks the active descriptor driven template pack and complete version resolver work.

Unmerged branch content is not treated as completed behavior. Only approved `main` content and verified remote configuration count toward phase completion.

## Global GitHub Operating Rules

### Source of truth

Use this order when resolving conflicts:

1. Current owner request.
2. `docs/general/plan.md`.
3. This GitHub completion plan.
4. Published schemas and pack contracts.
5. Catalogs, profiles, descriptors, templates, fixtures, tests, and evidence.
6. Supporting documentation and wiki pages.

### Branch and pull request model

1. `main` is the latest approved and verified repository state.
2. Work uses sequential branches under `envy/`.
3. Every phase branch begins at the current `origin/main` commit.
4. A later phase branch cannot begin until the prior phase pull request is merged, `origin/main` contains the merge commit, and the signed annotated phase tag is published.
5. Phase branches are never stacked.
6. Direct pushes to `main`, force pushes, history rewriting, and local fast forward integration are prohibited.
7. Pull requests use merge commits.
8. Required checks may not be bypassed, dismissed, or administratively skipped.
9. Historical phase branches and signed phase tags remain available for audit and rollback.

### Planning and traceability

1. Each phase has one milestone or an explicitly documented mapping to an existing repository milestone.
2. Independently actionable work receives one deduplicated issue or subissue.
3. Each issue and pull request is linked to the roadmap Project and appropriate milestone.
4. Project Status, Phase, Priority, Type, Target version, Effort, and Risk fields remain synchronized with actual work.
5. An issue moves to done only after its acceptance criteria pass and the satisfying pull request is merged.
6. The plan, issues, Project, milestones, pull requests, Actions, releases, documentation, and wiki are reconciled at every material state change.

### Evidence and status rules

1. `discovered` means authoritative metadata contains the version or artifact.
2. `resolvable` means the required coordinates, family, profile, wrapper, Java, mappings, and build plugin can be selected without contradiction.
3. `verified` means the exact tuple generated, compiled, packaged, and passed artifact inspection.
4. `legacy-verified` means the same checks passed under a pinned historical toolchain.
5. `experimental`, `blocked`, `withdrawn`, `broken`, and `deprecated` require an explicit reason and evidence.
6. One successful tuple never grants verified status to another tuple.
7. A source outage, empty response, parser failure, or unexpected bulk removal never deletes catalog content automatically.

### Security and cost controls

1. Source adapters use reviewed HTTPS origins, allowed paths, bounded responses, bounded redirects, and fail closed validation.
2. Repository workflows use least privilege permissions and full commit SHA Action pins.
3. Secrets, tokens, credentials, private keys, logs, local paths, generated caches, and untrusted binaries are never committed.
4. Untrusted pull request code never runs on a private self hosted runner.
5. Public GitHub hosted runners are preferred.
6. No paid runner, seat, collaborator, security product, Copilot overage, or metered feature is enabled without explicit cost approval.
7. Organization hard stop budgets remain enabled before scheduled or large matrix automation begins.

# Phase 1. GitHub Governance and Repository Control

## Objective

Establish and audit the GitHub controls required for safe sequential development, public collaboration, security review, and later immutable releases.

## Status

Complete. The identity reconciliation is present on `main`, and the verified signed annotated tag `phase-1-github-governance-reconciliation` points to that merge commit. The earlier `phase-1-github-governance` tag preserves the first governance audit. Every later phase must repeat the applicable drift checks.

## Workstreams

### Repository identity and ownership

1. Verify the repository owner is `MCEnvision` and the active authenticated account is `EnVisione`.
2. Verify `origin` resolves to the intended repository and the default branch is `main`.
3. Keep the repository public unless the owner explicitly changes visibility.
4. Preserve Issues and wiki support.
5. Keep Discussions disabled until a maintained community purpose exists.

### Git identity and signing

1. Configure every locally created repository commit with `EnVy` and `contact.enviouse@gmail.com` as both author and committer. Configure every annotated tag with that identity as tagger.
2. Use the registered EnVisione SSH signing key for locally created repository commits and annotated tags.
3. Verify signed repository commits and annotated tags on GitHub after push.
4. Treat GitHub generated pull request merge commits as platform authored objects. GitHub is their committer and must provide valid GitHub signature verification.
5. Require the merge author to be `EnVy`. Use the GraphQL `authorEmail` input with `contact.enviouse@gmail.com` for future merges when that merge interface is available.
6. Preserve already published verified merge commits even when they used another approved EnVisione account email. Do not rewrite protected history to change merge metadata.
7. Keep API authorization and signing verification as separate gates.

### Merge and branch protections

1. Allow merge commits.
2. Disable squash and rebase merging unless the owner explicitly changes policy.
3. Require pull requests for `main`.
4. Require resolved review conversations.
5. Block direct updates, force pushes, and branch deletion.
6. Enforce the ruleset for administrators.
7. Keep mandatory human approvals at zero unless explicitly requested.
8. Add only observed, stable, deterministic check names to required status checks.
9. Keep automatic branch deletion disabled so phase branches remain historical.

### Baseline repository files

1. Maintain repository specific issue forms for defects and features.
2. Maintain the pull request template.
3. Maintain CODEOWNERS.
4. Maintain the security policy.
5. Maintain release note categories.
6. Maintain path based pull request labels.
7. Maintain repository specific GitHub instructions.
8. Keep `AGENTS.md` and `.codegraph/` ignored and untracked.

### Native security and dependency controls

1. Keep CodeQL enabled for supported languages.
2. Keep native secret scanning and push protection enabled for the public repository.
3. Keep private vulnerability reporting enabled.
4. Keep the dependency graph, Dependabot alerts, and security updates enabled.
5. Keep Dependabot coverage for GitHub Actions and every detected package ecosystem and manifest directory.
6. Add dependency submission when generated Gradle or Maven verification projects require transitive dependency visibility.
7. Enable dependency review only where GitHub supports it without a permanently failing gate.

### Environments and release controls

1. Maintain `testing` and `production` environments without mandatory reviewers.
2. Add release specific environments only when release publication requires them.
3. Restrict environment access to approved branches, merge refs, and signed version tags.
4. Keep immutable releases enabled.

## Deliverables

1. A recorded GitHub capability audit.
2. A verified default branch ruleset.
3. Verified merge settings and workflow token permissions.
4. Verified environment, security, dependency, issue, and wiki settings.
5. A signed foundation merge commit and phase tag.

## Verification

1. Inspect repository settings through the GitHub API.
2. Confirm a direct update to `main` is blocked by policy.
3. Confirm a normal pull request can merge after required checks pass.
4. Confirm force push and deletion are disabled.
5. Confirm CodeQL, Dependabot, secret scanning, and push protection report no unexplained open alerts.
6. Confirm all Action references are pinned according to policy.

## Exit Criteria

1. Every required control is configured, verified, and documented.
2. Any unavailable optional capability is recorded accurately.
3. No unresolved authentication, signing, billing, collaborator, or ruleset blocker remains.
4. The merged foundation commit has a verified signed annotated tag.

# Phase 2. Planning, Issues, Projects, and Documentation Control

## Objective

Make GitHub the synchronized execution and evidence surface for all repository owned work without duplicating application repository responsibilities.

## Status

Phase 1 is merged and identified by the verified signed annotated tag `phase-1-github-governance-reconciliation`. Phase 2 is complete and identified by the verified signed annotated tag `phase-2-github-planning`. Its planning controls and documentation are merged, post merge checks passed, the Project and issue state were reconciled, and the wiki navigation was published. Later phases must preserve this planning contract.

## Workstreams

### Roadmap Project

1. Maintain one Project named `MCGen-Templates roadmap`.
2. Maintain Status, Phase, Priority, Type, Target version, Effort, and Risk fields.
3. Maintain Current phase, Roadmap, Board, Bugs, and Releases views where useful.
4. Configure native workflows for newly added items, reopened items, closed issues, and merged pull requests. Keep automatic archival disabled until the owner selects a retention period, then record that policy before enabling it.
5. Keep repository issues and pull requests automatically added when supported.

### Milestones and seven phase mapping

1. Map each phase in this document to one milestone or a documented parent milestone in the complete project plan.
2. Preserve already completed milestone history.
3. Do not assign application work to template repository milestones.
4. Do not invent due dates.
5. Keep milestone descriptions tied to measurable exit criteria.

The seven GitHub completion phases and the product phases in `docs/general/plan.md` are different planning layers. GitHub phases describe repository governance, evidence, and integration gates. Product phases describe implementation scope across the template repository and the future application repository. This repository keeps only the five product milestones it owns and maps GitHub work to them as follows:

| GitHub completion phase                                                     | Primary repository milestone             | Additional relationship                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Phase 1. GitHub governance and repository control                           | Phase 0. Repository foundation           | Completed foundation and governance evidence.                                                        |
| Phase 2. Planning, issues, Projects, and documentation control              | Phase 0. Repository foundation           | Establishes tracking for all later repository work.                                                  |
| Phase 3. Authoritative sources and complete compatibility catalog           | Phase 10. Complete catalog conformance   | Source adapters begin in Product Phase 0, but the complete catalog gate belongs to Product Phase 10. |
| Phase 4. Toolchain profiles, template families, and customization contracts | Phase 2. Reference template families     | Historic profiles also contribute to Product Phase 9.                                                |
| Phase 5. Generated project build and artifact verification                  | Phase 10. Complete catalog conformance   | Historic tuple verification also contributes to Product Phase 9.                                     |
| Phase 6. Pack publication, releases, and documentation                      | Phase 10. Complete catalog conformance   | Publication proves the complete approved pack.                                                       |
| Phase 7. Automated maintenance and repository complete gate                 | Phase 11. Automated template maintenance | Final completion depends on all earlier product milestone evidence.                                  |

This mapping does not create seven duplicate product milestones. An issue uses the milestone that owns its implementation result, while its Project Phase and Target version fields may record the applicable GitHub completion phase.

### Issue structure

1. Keep issue `1` as the parent implementation issue while its acceptance criteria remain active.
2. Create subissues for source adapters, catalog generation, profiles, template families, customization contracts, fixture generation, exact tuple verification, release publication, and maintenance automation when separate tracking adds value.
3. Record dependencies between subissues.
4. Search before creating issues to avoid duplicates.
5. Use security advisories instead of public issues for exploitable findings.

### Documentation ownership

1. Keep `README.md` as the user and contributor entry point.
2. Keep `docs/general/plan.md` as the complete product plan.
3. Keep this document as the focused GitHub execution plan.
4. Keep `docs/general/documentation.md` as the technical overview.
5. Maintain `docs/README.md` as the documentation index.
6. Maintain architecture, data, security, test, verification, release, migration, and troubleshooting documents when real content exists.
7. Treat tracked documentation as canonical.
8. Publish wiki navigation and curated operator pages only after the related tracked changes merge.

### Pull request evidence

1. Every phase pull request links its parent issue, subissues, milestone, and Project item.
2. The pull request body lists scope, non goals, compatibility effects, verification, risks, and rollback.
3. Required checks and independent review results are reconciled before merge.
4. The issue and Project item remain in review while the pull request is open.
5. Documentation and plan status change to complete only after merge and post merge verification.

## Deliverables

1. A documented mapping from the seven GitHub completion phases to the five repository owned product milestones.
2. Deduplicated issues and dependencies.
3. Synchronized Project fields and views.
4. Complete canonical documentation navigation.
5. Wiki navigation that points back to tracked sources.

## Verification

1. Compare plan phases, milestones, issues, Project items, and open pull requests.
2. Confirm every active issue has the correct milestone and Project status.
3. Confirm closed items correspond to merged and verified work.
4. Confirm wiki pages do not advertise unmerged behavior.
5. Confirm repository and application ownership boundaries are clear.

## Exit Criteria

1. No active repository task exists only in chat or an unlinked branch.
2. No stale issue, milestone, Project status, or wiki claim remains.
3. Each later phase has explicit entry criteria, work items, evidence, and exit criteria.
4. The verified signed annotated tag `phase-2-github-planning` identifies the merged Phase 2 commit on `main`.

# Phase 3. Authoritative Sources and Complete Compatibility Catalog

## Objective

Discover every official platform and component version, normalize compatibility evidence, and publish a deterministic catalog with no silent omissions.

## Status

Complete. Issues [17](https://github.com/MCEnvision/MCGen-Templates/issues/17) and [18](https://github.com/MCEnvision/MCGen-Templates/issues/18) were completed through [pull request 27](https://github.com/MCEnvision/MCGen-Templates/pull/27). The merge passed required pull request checks, post merge quality and CodeQL checks, and independent review. The verified signed annotated tag `phase-3-authoritative-sources-catalog` identifies the approved `main` commit with complete source adapters, immutable evidence snapshots, deterministic catalog generation, coverage, and drift evidence.

## Supported source adapters

1. Mojang version manifest and version metadata.
2. Forge loader artifacts, promotions, ForgeGradle, MCPConfig, MCP stable mappings, and MCP snapshot mappings.
3. NeoForge artifacts, NeoGradle, ModDevGradle, official versioning rules, and supported mapping sources.
4. Fabric Meta game, loader, mappings, intermediary, installer, Fabric API, Loom, and Fabric Language Kotlin sources.
5. Paper API metadata and Paper Fill project and build metadata.
6. Spigot API metadata.
7. Bukkit API metadata without substituting a Spigot or Paper coordinate.
8. SpongeAPI metadata and official compatibility documentation.
9. Velocity API metadata and protocol compatibility evidence.
10. BungeeCord API metadata, including historical snapshots and releases.
11. Architectury API, plugin, Loom, and official compatibility evidence.
12. Official Gradle release metadata and wrapper checksums.
13. Official Java requirements derived from Minecraft and platform documentation.
14. Kotlin and platform language adapter compatibility sources.

## Source ingestion requirements

1. Each adapter has a stable identifier and version.
2. Each source definition identifies the platform, category, primary source, prerequisite sources, corroborating sources, request limits, and additive removal policy.
3. Network policy validates the initial URL and every redirect before access.
4. Only reviewed HTTPS origins and path patterns are allowed.
5. Credentials, queries, fragments, nonstandard ports, private network targets, loopback targets, protocol downgrades, malformed redirects, and excessive redirects fail closed.
6. Response bytes, content type, retrieval time, ETag, Last Modified, digest, parser version, entry count, rejected values, and warnings are recorded.
7. Snapshots are immutable and never overwritten.
8. Empty responses, parser failures, outages, and unexpected removals retain the last known good snapshot.
9. Artifact mutation or withdrawal quarantines affected tuples and preserves historical evidence.

## Normalized catalog requirements

1. Use Minecraft keys for version bound platforms.
2. Use real API lines for API bound platforms.
3. Preserve prereleases, release candidates, snapshots, experiments, and historical versions.
4. Preserve every exact loader and API artifact.
5. Preserve mappings, build plugins, wrappers, Java versions, language adapters, and optional platform APIs as independent dimensions.
6. Record published, documented, verified, and inferred compatibility evidence separately.
7. Never create an unproven Cartesian product.
8. Provide deterministic recommendation policy with official markers preferred where available.
9. Keep manual Advanced values distinct from official catalog entries.
10. Publish content addressed platform shards and a small signed root index.

## Platform completion rules

### Forge

1. Every official Forge coordinate maps to its exact Minecraft key.
2. Intermediate and historical versions such as `1.9`, `1.10`, and `1.11` remain included.
3. Every exact Forge build remains selectable.
4. ForgeGradle, Gradle, Java, mappings, metadata format, run generation, and repository requirements resolve through explicit profiles.

### NeoForge

1. Both reduced and current full version conventions normalize correctly.
2. NeoForge, NeoGradle, and ModDevGradle remain independent component dimensions.
3. Every exact official artifact remains selectable.

### Fabric

1. Game, loader, mappings, intermediary, installer, Fabric API, Loom, and language adapter dimensions remain separate.
2. Exact game compatibility is proven from Fabric Meta or official publication evidence.
3. Stable and unstable flags remain separate.

### Plugins and proxies

1. Paper, Spigot, and Bukkit retain separate identities and coordinates.
2. Sponge, Velocity, and BungeeCord use actual API boundaries instead of fake Minecraft patch mappings.
3. Protocol and Minecraft support ranges remain separate evidence where available.

### Architectury and multiloader

1. A target exists only for a proven intersection of selected target loaders.
2. Shared and target specific component versions remain visible.
3. No unverified Cartesian product is recommended.

## Deliverables

1. Complete source definitions and adapters.
2. Immutable normalized snapshots.
3. Compatibility graph and catalog generator.
4. Platform catalog shards.
5. Deterministic recommendation policy.
6. Public coverage report with explicit blockers.
7. Source and catalog drift reports.

## Verification

1. Parser fixture tests for valid, invalid, duplicated, malformed, empty, reordered, added, and removed inputs.
2. Network policy tests for allowed URLs and blocked abuse cases.
3. Snapshot determinism tests.
4. Source to catalog completeness comparisons.
5. Duplicate coordinate, missing source index, ordering, digest, and schema validation.
6. Exact expected entry and rejection counts for every committed snapshot.
7. Review of every unexplained rejected value.

## Exit Criteria

1. Every supported platform has an authoritative adapter and immutable snapshot.
2. Every source entry appears in a catalog shard or explicit coverage blocker.
3. No rejected or missing value is unexplained.
4. Recommendation policy is deterministic and versioned.
5. Catalog generation is byte deterministic.
6. Required checks pass locally, on the pull request, and on `main`.

# Phase 4. Toolchain Profiles, Template Families, and Customization Contracts

## Objective

Create reusable template families and boundary profiles that generate minimal projects while exposing complete structured and raw customization.

## Status

Complete. Pull request [29](https://github.com/MCEnvision/MCGen-Templates/pull/29) merged into `main` at `7f9853e6b8277aea0518d9f446c9b4d70e0acd22`, all required pull request and post merge checks passed, and issue [19](https://github.com/MCEnvision/MCGen-Templates/issues/19) is closed. The signed annotated tag `phase-4-profiles-templates-customization` identifies the approved completion commit. Exact tuple compilation and artifact evidence remain Phase 5 gates. Profile records that are not yet backed by a complete catalog boundary remain explicit blockers rather than invented support.

## Toolchain profiles

Each profile must define:

1. Platform and catalog key constraints.
2. Exact component version ranges.
3. JDK runtime, Java language level, and bytecode target.
4. Gradle or Maven wrapper version and checksum.
5. Build plugin versions and repositories.
6. Mappings strategy.
7. Metadata renderer and file locations.
8. Source and resource layout.
9. Java and Kotlin support.
10. Optional feature support.
11. Known incompatibilities.
12. Verification commands.
13. Artifact patterns and inspection requirements.
14. Fallback, migration, and historical recovery behavior.

No generated build file may use `latest`, an unbounded dynamic version, or an unverified default.

## Required template families

1. Forge legacy families for each actual ForgeGradle, mappings, metadata, repository, Java, and run generation boundary.
2. Forge modern families for each actual structural boundary.
3. NeoForge families for NeoGradle and ModDevGradle boundaries.
4. Fabric families for game, Loom, mappings, source layout, and metadata boundaries.
5. Architectury and configurable multiloader families with common and selected target modules.
6. Bukkit families.
7. Spigot families.
8. Paper traditional plugin and modern Paper plugin families where supported.
9. Sponge families for historical metadata and API boundaries.
10. Velocity families.
11. BungeeCord families.

A new exact component version updates catalog data when structure is unchanged. A new family or fragment is added only for a real structural boundary.

## Simple mode contract

1. Present platform, Minecraft or API version, language, project name, identifier, package, main class, project version, description, authors, website, license, icon, common features, and destination related defaults.
2. Resolve a tested loader, API, mappings, build plugin, wrapper, Java, and language adapter tuple.
3. Show resolved values without requiring the user to edit them.
4. Surface warnings, active Advanced overrides, and verification state.
5. Generate a valid default project using identity inputs and recommended values.

## Advanced mode contract

1. Expose every schema supported metadata field.
2. Expose every exact catalog component version.
3. Accept syntactically valid manual versions as `custom-unverified` when outside catalog evidence.
4. Support arbitrary valid project versions, including alpha, beta, release candidate, snapshot, build metadata, and platform suffixes.
5. Support group, artifact, archive naming, classifier, appendix, extension, and complete file name overrides.
6. Support Gradle Groovy and Kotlin DSL where profiles allow them.
7. Support wrappers, plugins, mappings, Java, Kotlin, properties, JVM arguments, repositories, dependencies, configurations, source sets, resources, tasks, runs, manifests, packaging, and publishing.
8. Support complete platform metadata, commands, permissions, dependencies, entrypoints, mixins, access files, data generation, and target specific extensions.
9. Support add, replace, rename, delete, reset, and diff operations for generated text files.
10. Preserve raw overrides exactly and never execute them in canonical CI.
11. Preserve values when switching between Simple and Advanced modes.
12. Preserve dormant values when platform conditions temporarily hide them.

## PNG icon contract

1. Accept PNG only for the project icon slot unless a family explicitly supports another reviewed asset type.
2. Validate signature, decoder completion, dimensions, pixel count, size, aspect ratio, and output path.
3. Preserve alpha and provide deterministic transformation options.
4. Map the asset to the correct loader or platform metadata field.
5. Keep bytes binary safe and content addressed.
6. Test replacement, removal, export, import, and generated artifact inclusion.

## Metadata coverage

1. Fabric metadata covers identity, environment, entrypoints, contact, license, icons, mixins, access wideners, provided IDs, nested JARs, language adapters, dependencies, and custom fields.
2. Forge and NeoForge metadata covers loader properties, services, links, mods, display fields, logos, features, display tests, dependencies, ordering, ranges, and logical sides where supported.
3. Bukkit, Spigot, and Paper metadata covers identity, main class, bootstrapper, loader, API version, load phase, commands, permissions, dependencies, libraries, and Paper dependency graph fields where supported.
4. Sponge, Velocity, and BungeeCord metadata covers all supported identity, entrypoint, dependency, optionality, URL, author, description, load, and extension fields.
5. Multiloader metadata supports shared linked values and independent target overrides.

## Deliverables

1. Complete profile set.
2. Reviewed template descriptors.
3. Shared category bases and boundary fragments.
4. Template files with no unnecessary tutorial content.
5. Configuration, metadata, asset, field mapping, and capability schemas.
6. Minimal and maximum structured customization fixture specifications.
7. Template and profile documentation.

## Verification

1. Schema default, boundary, invalid, round trip, and migration tests.
2. Descriptor condition and field mapping tests.
3. Project version and artifact naming tests.
4. Metadata serialization tests.
5. PNG validation and binary integrity tests.
6. File operation, path collision, traversal, case folding, and override tests.
7. Deterministic output tests.
8. Minimal and maximum customization fixture generation.

## Exit Criteria

1. Every catalog boundary resolves to a reviewed family and profile or an explicit blocker.
2. Every family has complete Simple and Advanced contracts.
3. Every supported metadata field has a deterministic render target.
4. Project version and icon propagation are correct across build, metadata, publishing, README, and artifact output.
5. No unresolved placeholder or ignored control remains.

# Phase 5. Generated Project Build and Artifact Verification

## Objective

Prove that every tuple advertised as verified generates, compiles, packages, and contains the required metadata and entrypoints.

## Status

Active on `envy/phase_5_build_verification` from the verified Phase 4 completion commit. Issue [23](https://github.com/MCEnvision/MCGen-Templates/issues/23) is in progress. The branch adds deterministic fixture, matrix, bounded build, artifact, reproducibility, evidence, coverage, queue, reviewed batch execution, and audit contracts. The audit currently reports twelve blocked profiles, twelve blocked descriptors, and zero reviewed tuple evidence. No Phase 5 tuple is advertised as verified until a complete generated project build, artifact inspection, and reproducibility record exists for its exact identity.

## Verification levels

1. Source verification validates upstream evidence and normalization.
2. Compatibility verification validates graph edges, constraints, Java, wrappers, mappings, and profiles.
3. Generation verification validates minimal and maximum customization trees.
4. Build verification executes the exact declared command with the exact JDK and tuple.
5. Artifact verification inspects the produced JAR or plugin artifact.
6. Reproducibility verification compares repeated clean outputs and digests.

## Exact tuple policy

1. Every exact tuple labeled verified has its own evidence record.
2. Historical working tuples use `legacy-verified`.
3. Boundary sampling is only a fast pull request signal.
4. Sampling never grants status to unbuilt tuples.
5. A family or profile change invalidates every affected tuple.
6. Unrelated documentation changes do not invalidate tuple evidence.

## Fixture matrix

For each template family and boundary profile, generate:

1. Minimal recommended Java project.
2. Minimal recommended Kotlin project where supported.
3. Maximum structured customization project.
4. Alpha version project.
5. Beta version project.
6. Release candidate project.
7. Snapshot version project.
8. Build metadata version project.
9. Custom PNG icon project.
10. Optional feature combinations supported by the profile.
11. Raw override preservation fixture that is generated but not executed.
12. Multiloader target combinations proven by catalog evidence.

## Build execution

1. Use the exact profile JDK distribution and version.
2. Verify wrapper checksum before execution.
3. Run formatting, static validation, unit tests, data generation, GameTests, build, and packaging tasks where the profile declares them.
4. Use clean isolated work directories.
5. Do not mutate generated files during build.
6. Bound job time, output, disk use, retry count, and artifact retention.
7. Separate deterministic template failures from transient repository or network failures.

## Artifact inspection

Inspect:

1. Required metadata path and syntax.
2. Project identity and version consistency.
3. Entrypoint classes.
4. Resource namespace.
5. PNG icon bytes and metadata reference.
6. Mixin, access widener, access transformer, and class tweaker files where enabled.
7. Plugin commands, permissions, and dependency metadata where configured.
8. Manifest values.
9. Expected artifact name, classifier, extension, and publication coordinates.
10. Absence of secrets, local paths, caches, logs, and unexpected generated files.

## Scalable Actions design

1. Keep one fast pull request queue for changed adapters, schemas, profiles, recommended tuples, and boundary tuples.
2. Keep one new tuple queue for newly discovered components.
3. Keep one invalidation queue for family, profile, wrapper, JDK, mapping, or source changes.
4. Keep one scheduled audit queue for stale evidence and full catalog reconciliation.
5. Keep one bounded recovery queue for transient failures.
6. Use a content addressed evidence key containing source, family, profile, tuple, fixture, JDK, and procedure digests.
7. Reuse evidence only when every key part matches.
8. Shard large matrices deterministically.
9. Cancel superseded runs.
10. Upload sanitized summaries and bounded evidence artifacts.

## Deliverables

1. Fixture generator and deterministic fixture manifests.
2. Sharded matrix planner.
3. Build runner contracts.
4. Artifact inspector.
5. Evidence records keyed by exact tuple.
6. Public coverage and verification summaries.
7. Actions workflows and reusable central workflow inputs.

## Verification

1. Run the complete changed tuple set locally where possible.
2. Run pull request checks.
3. Run post merge `main` checks.
4. Verify evidence reuse and invalidation behavior.
5. Reproduce one modern and one historical tuple from published evidence.
6. Confirm raw custom build content is never executed.

## Exit Criteria

1. Every tuple labeled verified or legacy verified has current exact evidence.
2. Every other discovered tuple has an explicit status and blocker.
3. Minimal and maximum structured fixtures pass for every verified family and boundary.
4. Build and artifact evidence is reproducible and content addressed.
5. No unexplained flaky, failed, skipped, or permanently queued required job remains.

# Phase 6. Pack Publication, Releases, and Documentation

## Objective

Publish a deterministic, signed, independently verifiable template pack from approved `main` content.

## Status

Pending successful Phase 5 verification.

## Pack construction

1. Include schemas, source references, catalog index and shards, profiles, descriptors, family files, fragments, fixtures, and permitted evidence.
2. Exclude source credentials, caches, build output, temporary fixtures, logs, local paths, and untrusted user content.
3. Sort files deterministically.
4. Normalize archive metadata so the same source produces byte identical archives.
5. Record every file digest.
6. Record schema versions, pack version, source commit, catalog snapshot, family revisions, and profile revisions.

## Release evidence

Every release includes:

1. Signed annotated Git tag.
2. Source commit manifest.
3. Pack archive.
4. SHA 256 checksum.
5. SHA 512 checksum.
6. SPDX SBOM.
7. Coverage report.
8. Verification summary.
9. Supported GitHub artifact attestations.
10. Release notes describing compatibility additions, fixes, blockers, and migrations.

## Publication workflow

1. Build the release candidate from the exact approved `main` commit.
2. Run all release validation without modifying the repository.
3. Create a signed annotated release tag.
4. Create a draft immutable GitHub Release.
5. Attach every validated asset and evidence file.
6. Verify checksums, manifests, SBOM, and attestations after upload.
7. Publish only after every required asset is present and verified.
8. Verify the release tag, commit, assets, digests, and download behavior remotely.
9. Never rewrite a release tag or replace an immutable published asset.
10. Correct release defects in a new version.

## Offline and consumer contract

1. Consumers can download an exact pack version.
2. Consumers can verify commit, tag, archive, and file digests.
3. Consumers can load the pack without contacting loader sites.
4. Consumers can resolve one exact tuple from the bundled catalog and profiles.
5. Historical releases remain retrievable for reproducibility.

## Documentation and wiki

1. Update README status, layout, development, validation, compatibility, and release usage.
2. Update the documentation index.
3. Update technical architecture, source, catalog, profile, template, verification, security, and release documents.
4. Publish wiki navigation and operator pages after merge.
5. Link releases, coverage, issues, milestones, roadmap, and support paths.
6. Keep planned application behavior clearly separated from released template pack behavior.

## Deliverables

1. Deterministic pack builder.
2. Release validation workflow.
3. First signed immutable pack release.
4. Checksums, source manifest, SBOM, coverage, verification summary, and attestations.
5. Complete release and rollback documentation.
6. Updated wiki.

## Verification

1. Build the pack twice from clean checkouts and compare bytes.
2. Verify all file and archive digests.
3. Validate every bundled schema and reference.
4. Load and resolve representative modern, historical, plugin, proxy, and multiloader tuples offline.
5. Verify GitHub release immutability and signed tag state.
6. Verify all documentation and wiki links.

## Exit Criteria

1. The first pack release is complete, immutable, signed, and reproducible.
2. Every asset and evidence record verifies after download.
3. Consumers can use the pack offline from published content.
4. Documentation and wiki describe the released state accurately.

# Phase 7. Automated Maintenance and Repository Complete Gate

## Objective

Keep the repository complete after initial publication and prove that every required GitHub capability and template pack responsibility has an owner, automation path, recovery path, and evidence trail.

## Status

Pending the first pack release.

## Upstream monitoring

1. Monitor Mojang releases and snapshots.
2. Monitor Forge, ForgeGradle, promotions, and mappings.
3. Monitor NeoForge, NeoGradle, and ModDevGradle.
4. Monitor Fabric game, loader, mappings, API, Loom, installer, and language adapters.
5. Monitor Paper, Spigot, Bukkit, Sponge, Velocity, and BungeeCord metadata.
6. Monitor Architectury and multiloader component intersections.
7. Monitor Gradle wrappers, checksums, Java requirements, Kotlin, and platform build plugins.

## Safe reconciliation

1. Fetch with validators and bounded retries.
2. Compare the complete upstream set with the last known good snapshot.
3. Classify additions, removals, mutations, parser changes, and source failures.
4. Add new exact builds to existing catalog keys without copying templates.
5. Propose new profiles or fragments only when a structural boundary changes.
6. Generate and verify every newly discovered tuple before granting verified status.
7. Preserve old catalog content during outages or unexplained removals.
8. Require review for artifact mutation, source host changes, large removals, unsigned binaries, new repositories, and third party only compatibility evidence.

## Maintenance pull requests

1. Create deduplicated maintenance branches and pull requests.
2. Include source and catalog deltas.
3. Include affected family, profile, and tuple blast radius.
4. Include evidence invalidation and rebuild scope.
5. Include coverage changes and blockers.
6. Run deterministic checks and exact new tuple verification.
7. Never auto merge major platform, Java, Gradle, mappings, or build plugin boundary changes.

## Dependency and workflow maintenance

1. Audit Dependabot coverage whenever manifests change.
2. Group safe minor and patch updates where supported.
3. Keep major updates visible for explicit review.
4. Audit shared workflow caller drift.
5. Audit Action SHA pins and permissions.
6. Audit CodeQL, secret scanning, dependency alerts, and failed update jobs.
7. Audit rulesets, environments, merge settings, wiki, milestones, Project automation, release controls, and immutable release state.

## Failure and recovery operations

1. Classify source unavailable, artifact missing, artifact mutated, repository protocol failure, unsupported host JDK, profile mismatch, template defect, upstream defect, transient network failure, and test infrastructure failure separately.
2. Retry only transient failures with bounded backoff.
3. Quarantine deterministic compatibility or supply chain failures.
4. Preserve the previous pack release and evidence.
5. Publish a corrective release instead of rewriting history.
6. Record exact commands, exit codes, sanitized errors, affected tuples, and recovery actions.

## Repository complete audit

The GitHub side is complete only when all of the following are true:

1. Governance, signing, rulesets, environments, merge methods, Actions permissions, security features, dependency controls, and cost controls match policy.
2. The roadmap, milestones, issues, Project fields, pull requests, releases, plan, documentation, and wiki are synchronized.
3. Every supported platform has authoritative source adapters and current immutable snapshots.
4. Every discovered platform version, API line, and exact artifact appears in the catalog or has an explicit blocker.
5. Forge mappings, Java, Gradle, ForgeGradle, metadata, templates, and exact build choices are complete.
6. NeoForge and Fabric adapters, catalogs, profiles, mappings, APIs, language adapters, and templates are complete.
7. Bukkit, Spigot, Paper, Sponge, Velocity, and BungeeCord catalogs, profiles, metadata, and templates are complete.
8. Architectury and configurable multiloader intersections are proven and complete.
9. Simple and Advanced customization contracts cover every supported field and preserve all values and overrides.
10. PNG icons, arbitrary project versions, Gradle customization, dependencies, repositories, source layouts, tasks, runs, publishing, and raw file operations are covered by schemas and fixtures.
11. Every verified tuple has exact generation, compilation, packaging, and artifact inspection evidence.
12. Every nonverified discovered tuple has an accurate status and blocker.
13. The deterministic pack builder produces byte identical output.
14. The signed immutable release contains the pack, checksums, source manifest, SBOM, coverage, verification summary, and supported attestations.
15. Automated monitoring and reconciliation detect new upstream content without deleting old content silently.
16. No required check is failing, skipped, permanently pending, or bypassed.
17. No unexplained CodeQL, dependency, secret scanning, review, issue, or release finding remains.
18. No secret, local path, cache, log, generated build directory, unreviewed binary, or unrelated file is tracked.
19. Documentation and wiki describe the released state accurately.
20. Deferred GitHub App, website, generator service, Nginx, and Cloudflare work remains clearly separated.

## Deliverables

1. Automated source monitoring and catalog reconciliation.
2. Deduplicated maintenance pull request generation.
3. Evidence aware verification invalidation and rebuild planning.
4. Operational audit and recovery documentation.
5. Final repository completion report.
6. Current roadmap, issue, milestone, Project, release, documentation, and wiki state.

## Verification

1. Simulate a new exact component under an existing key.
2. Simulate a new compatibility boundary.
3. Simulate an upstream outage.
4. Simulate an empty or malformed response.
5. Simulate an unexpected bulk removal.
6. Simulate an artifact mutation.
7. Simulate a transient build failure and bounded retry.
8. Simulate a deterministic template failure and quarantine.
9. Rebuild a historical released tuple from pinned evidence.
10. Run the complete repository and remote GitHub audit.

## Exit Criteria

1. All twenty repository complete audit requirements pass.
2. All seven phase pull requests are merged through GitHub and tagged.
3. Required checks pass on the final `main` commit.
4. The first complete pack release verifies remotely.
5. Maintenance automation has proven addition, failure, quarantine, and recovery behavior.
6. Issue and Project state is done only for work whose evidence is complete.

## Phase Dependency Order

```text
phase 1. github governance and repository control
  phase 2. planning, issues, projects, and documentation control
    phase 3. authoritative sources and complete compatibility catalog
      phase 4. toolchain profiles, template families, and customization contracts
        phase 5. generated project build and artifact verification
          phase 6. pack publication, releases, and documentation
            phase 7. automated maintenance and repository complete gate
```

Later phase planning may occur early. Later phase implementation, pull requests, merges, and completion claims remain sequential.

## Final Completion Statement

The repository may be reported as fully set up and running only after Phase 7 passes. Until then, status reports must identify the highest merged phase, current branch, active issue, passing and failing verification, coverage counts, unresolved blockers, and next required gate.
