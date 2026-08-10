# Repository Completion Report

## Audit scope and result

This report records the final repository completion audit for MCEnvision/MCGen-Templates as observed on August 10, 2026. The audited base is origin/main at commit 31557f6, the merge commit for pull request 39. The audit covers the merged Phase 3 through Phase 6 evidence, the Phase 7 maintenance implementation, and the current remote GitHub state.

The result is **blocked**. Phases 3 through 6 have merged implementation and release evidence, but the repository is not yet eligible for the final Phase 7 completion tag. Twelve profile boundaries and twelve descriptor boundaries remain explicitly blocked, only two exact tuples have current build evidence, the wiki has not been reconciled with Phases 4 through 7, and issue 25 remains open.

This report distinguishes a completed contract or release gate from complete product coverage. A discovered catalog component is not treated as a build verified tuple, and a published prerelease is not treated as proof of complete platform support.

## Phase evidence

| Phase                                          | Merged evidence                                                                                                                                                                                    | Current counts and artifacts                                                                                                                                                                                                                                                                                             | Audit result                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3. Authoritative sources and catalog     | Pull request [27](https://github.com/MCEnvision/MCGen-Templates/pull/27), completion record [28](https://github.com/MCEnvision/MCGen-Templates/pull/28), tag phase-3-authoritative-sources-catalog | 14 source definitions, 14 current snapshots, 31 total retained snapshots, 1,019 current source records, 27,706 accepted entries, 20 rejected records with structured blockers, and 2,540 catalog shards in catalog/2026-08-10-r4                                                                                         | Passed for source ingestion and catalog coverage. Rejected values remain explicit blockers.                                                   |
| Phase 4. Profiles, families, and customization | Pull requests [29](https://github.com/MCEnvision/MCGen-Templates/pull/29) and [30](https://github.com/MCEnvision/MCGen-Templates/pull/30), tag phase-4-profiles-templates-customization            | 14 profiles, 14 descriptors, 4 committed customization fixtures, 2 reviewed profiles, and 12 blocked profiles. The matching Phase 5 audit records 12 blocked descriptors.                                                                                                                                                | Passed for declarative contracts. Exact generation and build support remains blocked for the unverified boundaries.                           |
| Phase 5. Generated project verification        | Pull requests [31](https://github.com/MCEnvision/MCGen-Templates/pull/31) and [32](https://github.com/MCEnvision/MCGen-Templates/pull/32), tag phase-5-build-verification                          | 2 verified exact tuples, 2 reproducible artifact records, 0 unresolved evidence records, 12 blocked profiles, and 12 blocked descriptors. The tuples are Spigot 1.21.1 with Temurin 21 and Gradle 8.8, and Spigot 1.8.8 with Temurin 8 and Gradle 7.6.4.                                                                 | Passed for every tuple labeled verified. It does not prove all cataloged families or all fixture variants.                                    |
| Phase 6. Pack publication and release          | Pull requests [33](https://github.com/MCEnvision/MCGen-Templates/pull/33) through [38](https://github.com/MCEnvision/MCGen-Templates/pull/38), tag phase-6-pack-publication                        | Immutable prerelease [v1.0.0-beta.1](https://github.com/MCEnvision/MCGen-Templates/releases/tag/v1.0.0-beta.1), 10 published assets, SHA-256 9ce3fd335bc24cc4e4a24d0016195d64ecc0f92658893e3c43167d5da7cbaa28, SPDX SBOM, source manifest, coverage, verification, rollback evidence, and archive and SBOM attestations. | Passed for deterministic publication and offline verification. The release intentionally contains only the currently verified tuple coverage. |
| Phase 7. Maintenance and completion gate       | Pull request [39](https://github.com/MCEnvision/MCGen-Templates/pull/39), no Phase 7 tag yet                                                                                                       | All 20 audit capability records are generated by the read only audit. Current live audit state is blocked because issue 25 is open.                                                                                                                                                                                      | Implementation merged. Final completion gate remains blocked.                                                                                 |

## Phase 3 catalog evidence

The current root index is [catalog/2026-08-10-r4/index.json](../../catalog/2026-08-10-r4/index.json). Its fourteen platform indexes reference the current immutable source snapshots. The coverage report records 27,706 accepted entries and 20 rejected source records. All accepted entries are represented, and each rejected value has an exact structured blocker.

The platform entry counts are:

| Platform     | Accepted entries | Rejected records |
| ------------ | ---------------: | ---------------: |
| Architectury |            1,130 |                0 |
| Bukkit       |               37 |                0 |
| BungeeCord   |               21 |                0 |
| Fabric       |            6,866 |                0 |
| Forge        |            8,390 |                1 |
| Gradle       |              521 |                0 |
| Java         |              887 |               18 |
| Kotlin       |              204 |                0 |
| Minecraft    |              905 |                0 |
| NeoForge     |            2,568 |                0 |
| Paper        |            5,955 |                1 |
| Spigot       |               82 |                0 |
| Sponge       |               74 |                0 |
| Velocity     |               66 |                0 |

The rejected values are not silent omissions. They are catalog coverage blockers and remain visible in the current coverage document. The catalog is therefore complete as a source representation, but it is not evidence that every discovered component can generate or compile a project. The accepted components remain `discovered` and the current coverage report does not yet attach a per component tuple blocker. That distinction is retained as a Phase 7 completion blocker.

## Phase 4 and Phase 5 boundary evidence

The profile and descriptor indexes contain fourteen platform and family boundaries. [verification/phase5/audit.json](../../verification/phase5/audit.json) is the authoritative count for the current build gate:

```text
profiles, 14 total, 2 reviewed, 12 blocked
descriptors, 14 total, 2 reviewed, 12 blocked
evidence, 2 total, 2 verified, 0 unresolved
```

The two exact evidence records are:

- [spigot-modern.json](../../verification/phase5/evidence/spigot-modern.json), Spigot API 1.21.1-R0.1-SNAPSHOT, Temurin 21, Gradle 8.8.
- [spigot-legacy.json](../../verification/phase5/evidence/spigot-legacy.json), Spigot API 1.8.8-R0.1-SNAPSHOT, Temurin 8, Gradle 7.6.4.

Both records contain successful build commands, artifact inspection, metadata validation, entrypoint inspection, and reproducibility digests. The other profile and descriptor boundaries remain blocked with reasons in their records and in the Phase 5 audit. They must not be promoted by sampling or by the success of either Spigot tuple.

The Phase 4 contract fixtures currently committed under fixtures/phase4 cover Simple alpha and release candidate inputs and Advanced beta and snapshot inputs. The contract test suite exercises additional invalid, round trip, icon, file operation, and deterministic rendering cases. A complete per family and per boundary build fixture matrix is still a required follow up for the blocked boundaries.

## Phase 6 release evidence

The published prerelease is immutable and its annotated tag is verified by GitHub with the EnVy signing identity. The release was built from the approved release commit recorded in [docs/verification/phase6-release.md](phase6-release.md), not from the later Phase 7 merge. That is valid historical release provenance. It also means the release must not be described as proof of complete current platform coverage. Consumers must use its bundled coverage and verification records to distinguish the two verified Spigot tuples from discovered and blocked values.

## Twenty requirement checklist

|   # | Requirement                                                                                                                           | State                   | Evidence and remaining action                                                                                                                                                                                                                                                     |
| --: | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Governance, signing, rulesets, environments, permissions, security, dependency, and cost controls                                     | Partial                 | The read only GitHub audit passes repository identity, rulesets, environments, current checks, and security alert controls. Cost budget records and every historical phase object still need one final reconciled audit.                                                          |
|   2 | Roadmap, milestones, issues, Project, pull requests, releases, plan, documentation, and wiki synchronization                          | Blocked                 | Tracked plan and issue state exist, but the wiki still presents a Phase 3 status page and does not link the Phase 4 through Phase 7 verification records. Several historical phase pull requests also lack the mapped milestone. Reconcile these objects before closing issue 25. |
|   3 | Authoritative adapters and current immutable snapshots                                                                                | Passed                  | Fourteen definitions and fourteen current snapshot directories are present. The current root index binds the fourteen snapshot digests, and the retained set contains 31 immutable snapshots.                                                                                     |
|   4 | Every discovered version and exact artifact appears in the catalog or has an explicit blocker                                         | Partial                 | Current coverage represents 27,706 accepted entries and records all 20 rejected records with exact blockers. Accepted components remain represented as discovered without a per component tuple blocker.                                                                      |
|   5 | Forge mappings, Java, Gradle, ForgeGradle, metadata, templates, and exact build choices                                               | Blocked                 | Forge source and contract records exist, but both Forge profiles remain blocked and no Forge tuple has exact build and artifact evidence.                                                                                                                                         |
|   6 | NeoForge and Fabric adapters, catalogs, mappings, APIs, language adapters, profiles, and templates                                    | Blocked                 | Source and catalog evidence exists, but the Fabric and NeoForge profiles and descriptors remain blocked and have no exact tuple evidence.                                                                                                                                         |
|   7 | Bukkit, Spigot, Paper, Sponge, Velocity, and BungeeCord support                                                                       | Blocked                 | All families and catalogs exist. Only two Spigot boundary tuples are verified. Bukkit, Paper, Sponge, Velocity, BungeeCord, and the general Spigot profile remain blocked.                                                                                                        |
|   8 | Architectury and configurable multiloader intersections                                                                               | Blocked                 | The catalog and descriptor exist, but no selected target intersection has exact build evidence.                                                                                                                                                                                   |
|   9 | Simple and Advanced contracts for every supported field                                                                               | Partial                 | Schemas and descriptors cover the contract surface and pass deterministic tests. Family and boundary promotion remains blocked until exact generation and build evidence exists for the remaining profiles.                                                                       |
|  10 | PNG icons, arbitrary versions, Gradle customization, dependencies, repositories, layouts, tasks, runs, publishing, and raw operations | Partial                 | The schemas and contract tests cover these controls, and four phase fixtures are committed. A complete per family and per boundary fixture and build matrix is not yet committed.                                                                                                 |
|  11 | Exact generation, compilation, packaging, and artifact evidence for every verified tuple                                              | Passed                  | Both tuples labeled verified have independent build, artifact, and reproducibility evidence. No other tuple is labeled verified.                                                                                                                                                  |
|  12 | Accurate status and blocker for every nonverified discovered tuple                                                                    | Blocked                 | Catalog rejections, blocked profiles, blocked descriptors, and Phase 5 audit reasons are explicit and content addressed. The 27,706 discovered catalog components still need per component tuple blocker or exact evidence mapping.                                               |
|  13 | Byte identical deterministic pack output                                                                                              | Passed                  | Phase 6 built two clean checkout candidates and compared archive, manifest, checksum, coverage, and SBOM digests.                                                                                                                                                                 |
|  14 | Signed immutable release with pack, checksums, manifest, SBOM, coverage, verification, and attestations                               | Passed                  | Release v1.0.0-beta.1 is immutable, signed, remotely published, and contains all ten required assets.                                                                                                                                                                             |
|  15 | Automated monitoring and safe reconciliation                                                                                          | Partial                 | Phase 7 monitoring, reconciliation, invalidation, proposal, quarantine, and recovery contracts are merged and locally tested. A successful live maintenance cycle and final completion issue closure remain outstanding.                                                          |
|  16 | No required check failing, skipped, permanently pending, or bypassed                                                                  | Passed for current main | Current post merge quality, CodeQL, Phase 5, Phase 6, and queue checks passed on main. The final Phase 7 scheduled audit remains a completion gate, not a passed final report.                                                                                                    |
|  17 | No unexplained CodeQL, dependency, secret, review, issue, or release finding                                                          | Partial                 | Current security and required check reads are healthy. Open backlog issues 20, 21, 22, and 25 are explained scope blockers, but they must remain synchronized with the final Project state.                                                                                       |
|  18 | No secret, local path, cache, log, build output, unreviewed binary, or unrelated tracked file                                         | Passed                  | Repository validation, tracked file hygiene checks, and pack exclusion checks pass.                                                                                                                                                                                               |
|  19 | Documentation and wiki accurately describe the released state                                                                         | Blocked                 | Tracked README and documentation describe Phases 3 through 7 accurately. The remote wiki remains stale and must be updated with Phase 4, Phase 5, Phase 6, Phase 7, release, and blocker navigation.                                                                              |
|  20 | Deferred GitHub App, website, generator service, Nginx, and Cloudflare ownership remains separate                                     | Passed                  | The GitHub plan and product plan explicitly assign those systems to the future MCEnvision/MCGen repository.                                                                                                                                                                       |

## Required next actions

1. Resolve or explicitly retain the twelve profile and twelve descriptor blockers while generating exact evidence for every boundary that will be advertised.
2. Expand the committed fixture and build matrix for every reviewed family and boundary, including maximum structured customization and supported language and target combinations.
3. Reconcile the roadmap Project, phase milestones, issue states, pull request metadata, and wiki pages. Do not close issue 25 while any checklist row remains blocked or partial.
4. Run the Phase 7 live audit and maintenance simulations from the reconciled main state, retain the resulting sanitized evidence, and verify addition, boundary, outage, quarantine, invalidation, proposal, and recovery behavior.
5. Create the signed Phase 7 tag only after the twenty requirement checklist is entirely passed, then reverify the final main commit and release state.

## Validation performed

The clean checkout at origin/main passed:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test, 25 files, 144 tests passed
npm run build
npm run validate, 9,268 canonical documents validated
npm audit --audit-level=high, zero vulnerabilities
```

The remote read only audit observed 20 capability records, 19 currently passing capability records, and one maintenance automation blocker caused by the still open Phase 7 completion issue. The broader checklist above intentionally retains the independent Phase 3 through Phase 6 product evidence blockers that a path existence check cannot discharge.
