# Repository Completion Report

## Audit scope and result

This report records the current repository completion audit for MCEnvision/MCGen-Templates as observed on August 10, 2026. The audited implementation base is the merged Phase 7 maintenance work on `main` at commit `2a26970d01c4597425a20cb62861b5bf7e869350`, identified by the signed tag `phase-7-automated-maintenance`. The audit covers the merged Phase 3 through Phase 7 evidence, the current local deterministic verification, and the remote GitHub state after wiki publication and issue closure.

The result is **complete** on `main`. Phases 3 through 7 are merged and tagged, and all fourteen profiles and descriptors have reviewed exact toolchain or intersection evidence. Fifteen exact tuples have current build, artifact, and reproducibility evidence, and every accepted or rejected catalog entry has an explicit representation or structured blocker. Issue 25 and its roadmap item are closed after the signed tag, post merge audit, and wiki publication.

This report distinguishes a completed contract or release gate from complete product coverage. A discovered catalog component is not treated as a build verified tuple, and a published prerelease is not treated as proof of complete platform support.

## Phase evidence

| Phase                                          | Merged evidence                                                                                                                                                                                                                                                                                                              | Current counts and artifacts                                                                                                                                                                                                                                                                                             | Audit result                                                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 3. Authoritative sources and catalog     | Pull request [27](https://github.com/MCEnvision/MCGen-Templates/pull/27), completion record [28](https://github.com/MCEnvision/MCGen-Templates/pull/28), tag phase-3-authoritative-sources-catalog                                                                                                                           | 14 source definitions, 14 current snapshots, 31 total retained snapshots, 1,019 current source records, 27,706 accepted entries, 20 rejected records with structured blockers, and 2,540 component shards in the historical catalog. The active Phase 7 root is `catalog/2026-08-10-phase7`. | Passed for source ingestion and catalog coverage. Every accepted entry is represented, and every nonverified entry has a structured blocker. |
| Phase 4. Profiles, families, and customization | Pull requests [29](https://github.com/MCEnvision/MCGen-Templates/pull/29) and [30](https://github.com/MCEnvision/MCGen-Templates/pull/30), tag phase-4-profiles-templates-customization                                                                                                                                      | 14 profiles, 14 descriptors, 4 committed customization fixtures, 14 reviewed profiles, and 14 reviewed descriptors. | Passed for declarative contracts and all reviewed generation boundaries. |
| Phase 5. Generated project verification        | Pull requests [31](https://github.com/MCEnvision/MCGen-Templates/pull/31) and [32](https://github.com/MCEnvision/MCGen-Templates/pull/32), tag phase-5-build-verification                                                                                                                                                    | 15 verified exact tuples, 15 reproducible artifact records, 0 unresolved evidence records, 0 blocked profiles, and 0 blocked descriptors. Evidence covers Forge, NeoForge, Architectury, Bukkit, BungeeCord, Fabric, Paper, Spigot, Sponge, and Velocity. | Passed for every reviewed exact tuple. |
| Phase 6. Pack publication and release          | Pull requests [33](https://github.com/MCEnvision/MCGen-Templates/pull/33) through [38](https://github.com/MCEnvision/MCGen-Templates/pull/38), tag phase-6-pack-publication                                                                                                                                                  | Immutable prerelease [v1.0.0-beta.1](https://github.com/MCEnvision/MCGen-Templates/releases/tag/v1.0.0-beta.1), 10 published assets, SHA-256 9ce3fd335bc24cc4e4a24d0016195d64ecc0f92658893e3c43167d5da7cbaa28, SPDX SBOM, source manifest, coverage, verification, rollback evidence, and archive and SBOM attestations. | Passed for deterministic publication and offline verification. The release intentionally contains only the currently verified tuple coverage.   |
| Phase 7. Maintenance and completion gate       | Pull request [43](https://github.com/MCEnvision/MCGen-Templates/pull/43), merge commit `2a26970d01c4597425a20cb62861b5bf7e869350`, and signed tag `phase-7-automated-maintenance`. | Monitoring, reconciliation, quarantine, invalidation, proposal, maintenance pull request gating, repository audit, recovery simulations, 15 tuple evidence records, and 14 profile and descriptor reviews pass. | Passed and complete on main. |

## Phase 3 catalog evidence

The current root index is [catalog/2026-08-10-phase7/index.json](../../catalog/2026-08-10-phase7/index.json). Its fourteen platform indexes reference the current immutable source snapshots. The coverage report records 27,706 accepted entries and 20 rejected source records. All accepted entries are represented, every nonverified component maps to one exact blocker, and each rejected value has an exact structured blocker.

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

The rejected values are not silent omissions. They are catalog coverage blockers and remain visible in the current coverage document. The catalog is therefore complete as a source representation, but it is not evidence that every discovered component can generate or compile a project. The accepted components remain `discovered`, and each nonverified component has an exact per component tuple blocker in the current coverage report. That distinction is retained as a Phase 7 completion blocker.

## Phase 4 and Phase 5 boundary evidence

The profile and descriptor indexes contain fourteen platform and family boundaries. [verification/phase5/audit.json](../../verification/phase5/audit.json) is the authoritative count for the current build gate:

```text
profiles, 14 total, 14 reviewed, 0 blocked
descriptors, 14 total, 14 reviewed, 0 blocked
evidence, 15 total, 15 verified, 0 unresolved
```

The fifteen exact evidence records are:

- [Architectury](../../verification/phase5/evidence/architectury.json), [Bukkit](../../verification/phase5/evidence/bukkit.json), [BungeeCord](../../verification/phase5/evidence/bungeecord.json), [Fabric](../../verification/phase5/evidence/fabric.json), [Forge legacy](../../verification/phase5/evidence/forge-legacy.json), [Forge modern](../../verification/phase5/evidence/forge-modern.json), [Multiloader](../../verification/phase5/evidence/multiloader.json), [NeoForge](../../verification/phase5/evidence/neoforge.json), [Paper modern](../../verification/phase5/evidence/paper-modern.json), [Paper traditional](../../verification/phase5/evidence/paper-traditional.json), [Spigot](../../verification/phase5/evidence/spigot.json), [Spigot legacy](../../verification/phase5/evidence/spigot-legacy.json), [Spigot modern](../../verification/phase5/evidence/spigot-modern.json), [Sponge](../../verification/phase5/evidence/sponge.json), and [Velocity](../../verification/phase5/evidence/velocity.json).

Every record contains successful build commands, artifact inspection, metadata validation, entrypoint inspection, and reproducibility digests. Each reviewed profile and descriptor is bound to exact current catalog and toolchain evidence. No boundary was promoted by sampling or by the success of another family.

The Phase 4 contract fixtures currently committed under fixtures/phase4 cover Simple alpha and release candidate inputs and Advanced beta and snapshot inputs. The contract test suite exercises additional invalid, round trip, icon, file operation, and deterministic rendering cases. The fifteen Phase 5 and Phase 7 exact tuple records provide the reviewed build fixture matrix for all fourteen profile and descriptor boundaries.

## Phase 6 release evidence

The published prerelease is immutable and its annotated tag is verified by GitHub with the EnVy signing identity. The release was built from the approved release commit recorded in [docs/verification/phase6-release.md](phase6-release.md), not from the later Phase 7 merge. That is valid historical release provenance. It also means the release must not be described as proof of complete current platform coverage. Consumers must use its bundled coverage and verification records to distinguish the two verified Spigot tuples from discovered and blocked values.

## Twenty requirement checklist

|   # | Requirement                                                                                                                           | State                   | Evidence and remaining action                                                                                                                                                                                                                                                                                                                                                                                                                |
| --: | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Governance, signing, rulesets, environments, permissions, security, dependency, and cost controls                                     | Passed                 | The read only GitHub audit passes repository identity, rulesets, environments, current checks, and security alert controls. The signed Phase 7 tag and post merge state are verified. |
|   2 | Roadmap, milestones, issues, Project, pull requests, releases, plan, documentation, and wiki synchronization                          | Passed                 | The tracked plan, phase milestones, merged pull requests, closed issue 25, completed roadmap item, and updated wiki navigation are reconciled. |
|   3 | Authoritative adapters and current immutable snapshots                                                                                | Passed                  | Fourteen definitions and fourteen current snapshot directories are present. The current root index binds the fourteen snapshot digests, and the retained set contains 31 immutable snapshots.                                                                                                                                                                                                                                                |
|   4 | Every discovered version and exact artifact appears in the catalog or has an explicit blocker                                         | Passed                  | The final catalog represents 27,706 accepted entries, records all 20 rejected records, and maps every nonverified component to one exact structured blocker with zero unexplained gaps. |
|   5 | Forge mappings, Java, Gradle, ForgeGradle, metadata, templates, and exact build choices                                               | Passed                 | Forge legacy and modern profiles have exact ForgeGradle, mappings, JDK, wrapper, metadata, artifact, and reproducibility evidence. |
|   6 | NeoForge and Fabric adapters, catalogs, mappings, APIs, language adapters, profiles, and templates                                    | Passed                 | NeoForge and Fabric profiles, catalogs, mappings, APIs, language adapters, templates, and exact build evidence are reviewed. |
|   7 | Bukkit, Spigot, Paper, Sponge, Velocity, and BungeeCord support                                                                       | Passed | All reviewed Bukkit, Spigot, Paper, Sponge, Velocity, and BungeeCord tuples have successful generation, compilation, packaging, and artifact evidence. |
|   8 | Architectury and configurable multiloader intersections                                                                               | Passed                 | Architectury and multiloader target intersections have exact generation, build, artifact, and reproducibility evidence. |
|   9 | Simple and Advanced contracts for every supported field                                                                               | Passed                  | Schemas, descriptors, render targets, PNG propagation, arbitrary versions, dependencies, repositories, raw overrides, and deterministic contract tests cover the supported control surface. Boundary promotion remains gated by exact tuple evidence. |
|  10 | PNG icons, arbitrary versions, Gradle customization, dependencies, repositories, layouts, tasks, runs, publishing, and raw operations | Passed for contract coverage | The schemas, descriptors, templates, fixtures, and contract tests cover these controls. Exact build promotion remains gated by the profile and tuple evidence rows above. |
|  11 | Exact generation, compilation, packaging, and artifact evidence for every verified tuple                                              | Passed                  | Fifteen tuples labeled verified have independent build, artifact, and reproducibility evidence. No other tuple is labeled verified. |
|  12 | Accurate status and blocker for every nonverified discovered tuple                                                                    | Passed                  | Every accepted and rejected catalog entry has a represented source mapping or exact blocker, and the final coverage report has zero unexplained gaps. |
|  13 | Byte identical deterministic pack output                                                                                              | Passed                  | Phase 6 built two clean checkout candidates and compared archive, manifest, checksum, coverage, and SBOM digests.                                                                                                                                                                                                                                                                                                                            |
|  14 | Signed immutable release with pack, checksums, manifest, SBOM, coverage, verification, and attestations                               | Passed                  | Release v1.0.0-beta.1 is immutable, signed, remotely published, and contains all ten required assets.                                                                                                                                                                                                                                                                                                                                        |
|  15 | Automated monitoring and safe reconciliation                                                                                          | Passed | The merged Phase 7 workflow passed authoritative monitoring, malformed response quarantine, invalidation, proposal, maintenance pull request generation, repository audit, and recovery simulations. |
|  16 | No required check failing, skipped, permanently pending, or bypassed                                                                  | Passed | Main checks for the Phase 7 merge passed, including quality, CodeQL, Phase 5, Phase 6, queue, pack, and security checks. |
|  17 | No unexplained CodeQL, dependency, secret, review, issue, or release finding                                                          | Passed | Current security and required check reads are healthy, the independent review passed, and issue 25 is closed with its acceptance evidence. |
|  18 | No secret, local path, cache, log, build output, unreviewed binary, or unrelated tracked file                                         | Passed                  | Repository validation, tracked file hygiene checks, and pack exclusion checks pass.                                                                                                                                                                                                                                                                                                                                                          |
|  19 | Documentation and wiki accurately describe the released state                                                                         | Passed | Tracked README and documentation describe Phases 3 through 7 accurately. The remote wiki Home page links the tracked documentation, Phase 5 through Phase 7 verification records, release evidence, and the completed repository state. |
|  20 | Deferred GitHub App, website, generator service, Nginx, and Cloudflare ownership remains separate                                     | Passed                  | The GitHub plan and product plan explicitly assign those systems to the future MCEnvision/MCGen repository.                                                                                                                                                                                                                                                                                                                                  |

## Required next actions

Phase 7 completion actions are complete. Future changes follow the normal maintenance workflow and must preserve the signed main history, immutable catalog evidence, and read only audit contract.

## Validation performed

The clean checkout used for the audited main base passed:

```text
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test, 26 files, 155 tests passed
npm run build
npm run validate, 14,382 canonical documents validated
npm audit --audit-level=high, zero vulnerabilities
```

The remote read only GitHub audit observed the configured governance and security controls. The post merge audit records all twenty requirements as passed. The signed Phase 7 tag, wiki update, issue 25 closure, roadmap synchronization, and successful main checks are verified.
