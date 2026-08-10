# repository instructions

## current scope

this repository owns versioned mcgen template packs, compatibility catalogs, source adapters, toolchain profiles, schemas, fixtures, and verification evidence. the website, api, github app, account data, queues, and nginx deployment belong in the future `MCEnvision/MCGen` application repository.

phase 0 is active. the github foundation is merged and tagged. current work owns serialized contracts, source adapters, immutable snapshots, deterministic validation, and the later template, catalog, profile, fixture, and verification layers.

## sources of truth

follow the current owner request, then `docs/general/plan.md`, schemas and manifests, implementation and tests, and the remaining documentation. distinguish planned behavior from implemented behavior.

## architecture

- use reusable template families and boundary fragments. never create one branch or complete project tree for every platform and version.
- represent exact loader, api, mappings, wrapper, build plugin, language, and java compatibility as catalog data and toolchain profiles.
- keep descriptors declarative and bounded. descriptors cannot execute code or access the filesystem, environment, process, network, time, randomness, reflection, or credentials.
- keep authoritative source adapters outside generator core. record provenance, cache validators, response digests, parser versions, warnings, and rejected entries.
- preserve deterministic generation. never emit mutable `latest` selectors into generated build files.
- treat the compatibility tuple as verified only after tuple specific generation, build, and artifact evidence passes.
- keep simple mode curated and compatible. expose manual versions, raw operations, and experimental inferred relationships only in advanced mode with validation and warnings.
- treat uploaded png files, imported specifications, raw overrides, remote packs, and generated build logic as untrusted.
- never copy minecraft development plugin source or bundled templates without an explicit legal and redistribution review.

## change requirements

- integrate new behavior into the active plan before implementation.
- link independently trackable work to the correct issue, milestone, and roadmap item.
- update schemas, fixtures, verification, documentation, coverage state, provenance, and license records with the affected behavior.
- use exact supported versions backed by committed evidence. examples without evidence must use placeholders.
- preserve historical source snapshots, catalog evidence, pack releases, tags, and migration paths.
- do not commit generated projects, build output, caches, logs, local configuration, credentials, or machine specific paths.

## review priorities

focus on correctness, deterministic output, catalog integrity, compatibility boundaries, provenance, licensing, archive and path safety, untrusted input, secret exposure, regressions, failure recovery, and missing verification. cite exact files and reproducible behavior for blocking findings.

## verification

use node 22 and the npm lockfile. run `npm run verify` for implementation changes. run the documented schema, source, snapshot, fixture generation, tuple build, artifact inspection, coverage, and packaging checks that apply.

do not approve when a required check failed, exact compatibility evidence is absent, documentation describes unmerged behavior as implemented, or the final diff contains credentials, generated output, machine local state, or unrelated changes.
