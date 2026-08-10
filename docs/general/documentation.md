# MCGen Templates Technical Overview

## Status

MCGen Templates is in Phase 0, template-pack contract foundation. The GitHub collaboration and security gate is merged and tagged. The repository now contains versioned JSON schemas, a locked Node.js 22 validation toolchain, deterministic digest and canonical JSON utilities, Mojang and Forge source adapters, parser tests, and one immutable normalized Forge source snapshot. It does not yet contain a template family, compatibility catalog, toolchain profile instance, generated project fixture, published package, or release artifact.

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

`schemas/`, `sources/`, `src/`, and `tests/` are implemented. `templates/`, `catalog/`, profile instances, and generated fixtures remain planned until their exact content and evidence are reviewed. `fixtures/` will contain deterministic generation cases, not generated build output.

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

See [Template Pack Trust Model](../security/trust-model.md) for security requirements.

## GitHub Workflow

`main` is the canonical approved source. Work uses sequential `envy/phase_*` branches. Each phase branch starts from the latest merged `origin/main`. A later phase cannot start until the prior phase pull request is merged and its merged commit has a signed annotated tag.

The default-branch ruleset blocks direct updates, deletion, and force pushes. Pull requests use merge commits and require resolved conversations. Required check names are added only after GitHub observes stable successful runs.

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

`npm run snapshot:forge -- --output <repository path>` captures a new source snapshot without overwriting an existing file. GitHub Actions run the same locked Node.js checks through the pinned central reusable workflow, plus documentation validation, credential scanning, and dependency review.

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

No template-pack release exists yet. Future releases use immutable GitHub Releases created from signed annotated tags. Each release will include the pack archive, SHA-256 and SHA-512 checksums, source-commit manifest, SPDX SBOM, and supported attestations.

Release validation remains disabled until a real deterministic pack artifact exists. See [Template Pack Releases](../release/template-pack-releases.md).

## Known Limitations and Decisions Pending

- No repository license has been selected.
- No template descriptor instance has been implemented.
- No compatibility tuple has been generated or verified.
- Forge discovery does not yet resolve ForgeGradle, Gradle, Java, mappings, recommendation, generation, build, or artifact evidence.
- Source adapters for other planned platforms are not implemented yet.
- No template-pack release has been published.

These limitations block claims of template availability, but they do not change the approved architecture or complete-coverage requirement.

## Documentation Map

- [Documentation Index](../README.md)
- [Active Plan](plan.md)
- [Contribution Guide](contributing.md)
- [Template Pack Architecture](../architecture/template-pack.md)
- [Template Pack Trust Model](../security/trust-model.md)
- [GitHub Foundation Verification](../verification/github-foundation.md)
- [Template Pack Releases](../release/template-pack-releases.md)
