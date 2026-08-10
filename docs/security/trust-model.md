# Template Pack Trust Model

## Assets in Scope

This repository will publish descriptors, template text, schemas, catalog data, source snapshots, profiles, fixtures, evidence, and pack archives. Generated projects may contain build scripts and dependencies, but generated user projects are not canonical repository content.

## Trusted Inputs

Only reviewed files merged into the canonical repository and included in a signed pack release are trusted first-party inputs. A successful merge alone does not make a compatibility tuple Verified. Tuple-specific generation, build, and artifact evidence is also required.

## Untrusted Inputs

Treat these as untrusted:

- Imported project specifications.
- Raw file overrides.
- Uploaded PNG files and other permitted assets.
- Manual component versions.
- Third-party template packs.
- Remote and local pack archives.
- Upstream metadata responses until normalized and validated.
- Generated Gradle, Maven, Java, Kotlin, shell, and workflow files.

## Execution Boundary

The public MCGen service may parse, validate, transform, preview, and package untrusted input. It must not execute build scripts, plugins, dependencies, generated source, shell commands, Git commands, descriptor code, or uploaded binaries.

Canonical fixture builds execute only after pull-request review and through bounded workflows. Public fork code must never run on a private self-hosted runner.

## Path and Archive Safety

All virtual paths use normalized relative POSIX form. Reject absolute paths, parent traversal, control characters, invalid names, case-folding collisions, device names, excessive depth, excessive length, symlinks, and writes into adapter-private state.

ZIP and pack loaders must bound file count, individual size, expanded size, path depth, compression ratio, and total bytes before extraction.

## Descriptor Safety

Descriptor conditions and derivations use a documented expression language with bounded evaluation. They cannot access the filesystem, environment, process APIs, reflection, network, time, randomness, or credentials.

Unknown descriptor schema versions fail closed. Unknown namespaced project fields may be preserved only when the current schema permits them.

## Source and Artifact Integrity

Each authoritative response and normalized snapshot receives a digest. Artifact mutation under an existing version quarantines the affected tuple. Previously recorded evidence remains historical and new generation is disabled until reviewed.

Pack clients verify release identity, source commit, schema versions, and content digests before use. Mutable branch heads and unverified aliases are not generation inputs.

## Secret Handling

Project specifications and pack content must never contain credentials. Reject secret-looking portable values where practical and direct users to environment variables or GitHub secrets for publishing credentials.

Repository workflows use least-privilege tokens. Secrets are never exposed to pull requests from forks or passed into central quality workflows.

## Third-Party Licensing

The Minecraft Development plugin is licensed under LGPL 3.0 only. MCGen may study its public architecture and interaction model, but it does not copy plugin source or bundled templates without a recorded legal and redistribution review.

Every imported starter project, MDK, schema, or asset records its source, version, license, digest, import date, modifications, attribution duties, and redistribution decision before publication.

## Vulnerability Reporting

Report exploitable vulnerabilities through GitHub private vulnerability reporting. Do not open a public issue containing credentials, private infrastructure, exploit code, or sensitive reproduction data.
