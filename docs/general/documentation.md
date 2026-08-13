# MCGen Templates Technical Overview

## Status

MCGen Templates completed the original seven repository phases. Phase 14 is the active source language and Gradle DSL prerequisite. It introduces ProjectSpec version 3, independent source language and build selections, truthful descriptor and profile capabilities, and exact language and DSL evidence. Forty reference combinations across Bukkit, BungeeCord, Fabric, Paper, Spigot, Sponge, and Velocity pass two isolated builds, artifact inspection, byte reproducibility, and output tree reproducibility. Forge, NeoForge, Architectury, and multiloader remain Java with Groovy DSL because no unverified language or DSL combination is advertised.

Planned behavior must not be described as available until its implementation is merged and verified. The [active plan](plan.md) is the source of truth for unfinished work.

## Purpose and Ownership

MCGen Templates will publish the canonical first-party inputs used to generate Minecraft development projects. It owns:

- Descriptor-driven template families.
- Conditional files and compatibility-boundary fragments.
- Authoritative version-source adapters and normalized source snapshots.
- Compatibility catalog keys and exact component tuples.
- Toolchain profiles for Java, Gradle or Maven, build plugins, mappings, metadata formats, and verification commands.
- Minimal and maximum-customization fixtures.
- Tuple-specific generation, build, and artifact evidence.
- Immutable template-pack releases and provenance.

It does not own the browser application, API service, CLI, generator-core implementation, GitHub App, Nginx deployment, or Cloudflare configuration. Those components belong in the future `MCEnvision/MCGen` repository.

## Architectural Model

MCGen uses a small set of reusable template families rather than a Git branch for every platform and version.

```text
authoritative source metadata
  normalized source snapshot
  compatibility catalog and profiles

template descriptor and family files
  typed fields
  derived values
  conditions
  boundary fragments

pinned project specification and assets
  deterministic renderer in MCGen
  virtual file tree
  zip, local, api, or github adapter
```

Minecraft versions, API lines, exact loader builds, mappings, build plugins, wrappers, Java versions, and language adapters are catalog data. A new upstream version updates catalog data when the existing family and profile remain structurally compatible. A new family or boundary fragment is required only when generated structure or behavior changes.

The architecture is informed by the Minecraft Development plugin's descriptor, property, conditional-file, and version-resolver separation. MCGen does not copy the plugin's LGPL-licensed source or bundled templates without a separate license review.

## Repository Layout

```text
templates/
  <platform>/
    template.mcgen.json
    files/
    fragments/

catalog/
  index.json
  platforms/
  profiles/
  evidence/
  coverage.json

schemas/
sources/
fixtures/
src/
tests/
docs/
.github/
```

`schemas/`, `sources/`, `catalog/`, `src/`, `tests/`, `templates/`, reviewed profiles, and deterministic fixtures are implemented. Exact Phase 5 execution inputs and evidence live under `verification/phase5/`. Generated build directories and artifacts remain outside the repository.

## Data Ownership and Resolution

One compatibility tuple records:

```text
platform and project category
minecraft or api catalog key
exact loader or api artifact
exact mappings and platform api selections
exact build plugin and wrapper
java language and bytecode targets
language adapters
template family and profile
release channel
source evidence
verification status
```

The catalog owns version availability and compatibility edges. The descriptor owns user-facing fields, field behavior, file conditions, destinations, and platform capabilities. The profile owns toolchain compatibility and verification. The project specification owns user intent. No layer may silently rewrite an explicit user selection.

## Determinism and Provenance

Every published pack will identify:

- Pack semantic version.
- Signed annotated tag.
- Source commit.
- Pack and file digests.
- Descriptor and catalog schema versions.
- Source snapshot digest.
- Template family and profile revisions.
- Exact tuple evidence.

The same pack digest, catalog snapshot, tuple, project specification, and asset bytes must generate a byte-identical file tree through every interface.

## Trust Boundaries

Canonical descriptors and family files are trusted repository content reviewed through pull requests. Project specifications, raw file overrides, uploaded assets, local packs, and remote packs are untrusted input.

The public generation service may validate and package untrusted input, but it must never execute generated Gradle, Maven, Java, Kotlin, shell, Git, descriptor, or uploaded binary content. Conditions use a bounded expression language without network, process, filesystem, reflection, or arbitrary-code access.

Canonical source capture is a separate maintainer-only network path. Repository source definitions cannot expand network authority by themselves. A definition names every source resource, gives it a primary, prerequisite, or corroborating role, and declares its expected media types. Each resource ID resolves through a code-owned policy containing exact HTTPS URLs, approved media types, and a redirect limit. Every initial or redirect URL is checked before access. Invalid, credentialed, downgraded, undeclared, unexpected-media-type, or excessive-redirect targets fail before parsing or snapshot writes. Capture records retain the source ID, requested URL, final URL, redirect chain, cache validators, response digest, and byte count.

See [Template Pack Trust Model](../security/trust-model.md) for security requirements.

## GitHub Workflow

`main` is the canonical approved source. Work uses sequential `envy/phase_*` branches. Each phase branch starts from the latest merged `origin/main`. A later phase cannot start until the prior phase pull request is merged and its merged commit has a signed annotated tag.

The default-branch ruleset blocks direct updates, deletion, and force pushes. Pull requests use merge commits and require resolved conversations. Required check names are added only after GitHub observes stable successful runs. Every locally created repository commit and annotated tag uses the EnVy SSH signing identity and `contact.enviouse@gmail.com`. GitHub generated merge commits retain GitHub as their verified platform committer, and future GraphQL merges explicitly select `contact.enviouse@gmail.com` for the EnVy merge author. The [GitHub completion plan](github_plan.md) defines the seven repository completion phases, and the [Phase 1 governance audit](../verification/github-foundation.md) records the exact configured controls and evidence.

The seven GitHub completion phases are integration and evidence gates. They map to the five product milestones owned by this repository and do not replace or renumber the product phases in the active plan. The [Phase 2 planning verification](../verification/github-planning.md) defines that mapping, the Project and issue contract, application ownership boundaries, and the post merge completion gate.

GitHub destination branches created by MCGen are user project output. They are unrelated to template storage and do not require matching branches in this repository.

## Current Development Commands

Use Node.js 22 and the checked-in npm lockfile:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run verify
```

`node dist/cli.js snapshot <adapter> --output <repository path>` captures a new source snapshot without overwriting an existing file. `node dist/cli.js catalog generate --output <repository directory>` derives content-addressed catalog data only from immutable snapshots. `node dist/cli.js catalog drift --baseline <snapshot> --candidate <snapshot> --output <report>` produces a non-destructive drift report for one source family. GitHub Actions run the same locked Node.js checks through the pinned central reusable workflow, plus documentation validation, credential scanning, and dependency review.

## Verification Policy

Documentation-only changes require:

1. `git diff --check`.
2. Markdown fence-pair validation.
3. Link and path review.
4. Secret and machine-local-path review.
5. Tracked-file audit.
6. Successful GitHub quality checks.

Future template changes additionally require descriptor and schema validation, deterministic fixture generation, tuple-specific builds with the profile JDK, artifact inspection, and coverage reconciliation. A tuple is never marked Verified or Legacy Verified without exact evidence.

## Release Policy

Published template-pack prereleases from `v1.0.0-beta.1` through `v1.0.0-beta.7` are immutable. Phase 14 prepares `v1.0.0-beta.8` as the next immutable candidate without claiming publication before merge. Future releases use immutable GitHub Releases created from signed annotated tags. Each release includes the pack archive, SHA-256 and SHA-512 checksums, source-commit manifest, SPDX SBOM, coverage, verification summary, rollback result, and supported attestations.

Phase 6 release validation is active through the tag-only [immutable release workflow](../../.github/workflows/phase6-release.yml). It requires a signed release tag, a clean main checkout, complete release assets, remote verification, and offline consumer checks. The [phase 6 release verification record](../verification/phase6-release.md) records the published beta evidence. See [Template Pack Releases](../release/template-pack-releases.md).

Phase 7 maintenance validation is active through the scheduled and manually dispatched [maintenance workflow](../../.github/workflows/phase7-maintenance.yml). It runs repository verification, deterministic monitor and recovery simulations, and the twenty requirement repository audit without publishing from partial evidence. See [Phase 7 Maintenance Verification](../verification/phase7-maintenance.md) and the [repository audit procedure](../operations/repository-audit.md).

## Known Limitations

- No repository license has been selected.
- Forge, NeoForge, Architectury, and multiloader advertise only Java source with Groovy Gradle DSL. Kotlin and Kotlin DSL require reviewed platform adapters, metadata, topology, and exact evidence before they can be exposed.
- Maven is part of the portable ProjectSpec contract but is not advertised by this pack because it has no released Maven descriptor and exact evidence.
- Catalog entries outside the reviewed reference tuples remain discovered with explicit blockers. Discovery is not a build verification claim.
- `v1.0.0-beta.7` is the latest published prerelease. The `v1.0.0-beta.8` candidate and a stable release are not yet published.

## Documentation Map

- [Documentation Index](../README.md)
- [Active Plan](plan.md)
- [GitHub Completion Plan](github_plan.md)
- [Contribution Guide](contributing.md)
- [Template Pack Architecture](../architecture/template-pack.md)
- [Template Pack Trust Model](../security/trust-model.md)
- [GitHub Foundation Verification](../verification/github-foundation.md)
- [GitHub Planning Verification](../verification/github-planning.md)
- [Phase 5 Build and Artifact Contracts](../verification/phase5-build-contracts.md)
- [Template Pack Releases](../release/template-pack-releases.md)
- [Pack Construction](../release/pack-construction.md)
- [Phase 6 Release Verification](../verification/phase6-release.md)
- [Phase 7 Maintenance Verification](../verification/phase7-maintenance.md)
- [Upstream Monitoring](../operations/upstream-monitoring.md)
- [Failure Recovery](../operations/failure-recovery.md)
- [Repository Completion Audit](../operations/repository-audit.md)
