# Template Pack Releases

## Current Status

No template-pack release exists yet. Phase 6 implementation is merged and tagged as `phase-6-pack-publication`. The deterministic pack builder and release evidence contract are available. Publication remains gated until the first pack artifact is generated from approved `main`, all release assets and attestations verify, offline consumers resolve representative tuples, rollback is tested, and the owner approves publication.

## Release Identity

Each release records:

- Semantic pack version.
- Signed annotated Git tag.
- Merged source commit.
- Descriptor and catalog schema versions.
- Source snapshot digest.
- Family and profile revisions.
- Exact verified tuple evidence.
- Pack archive SHA-256 and SHA-512 digests.

Published releases are immutable. Corrections require a new version and tag.

## Required Assets

A release must include:

```text
template-pack archive
sha-256 checksums
sha-512 checksums
source-commit manifest
spdx sbom
supported build and sbom attestations
coverage report
```

The release remains a draft until every asset is generated from the same merged commit, verified, uploaded, and cross-checked.

## Release Gate

Before publication:

1. Validate descriptors, schemas, profiles, conditions, catalog shards, and coverage.
2. Rebuild the pack and prove deterministic digests.
3. Generate minimal and maximum-customization fixtures for every affected family and profile.
4. Build every tuple advertised as Verified or Legacy Verified.
5. Inspect packaged metadata, entrypoints, resources, icons, mixins, access files, versions, and artifact names.
6. Verify the signed tag targets the approved merged `main` commit.
7. Generate checksums, source manifest, SBOM, and supported attestations.
8. Publish the immutable release.
9. Verify all assets, links, attestations, catalog references, and offline retrieval after publication.

## Rollback and Revocation

Do not rewrite or reuse a published tag. A defective release is marked unsafe in the catalog and release notes, then superseded by a new release. Clients retain explicit pins but must receive a clear warning or block when a security or supply-chain issue requires it.

Artifact mutation or missing upstream content quarantines affected tuples without deleting historical evidence.
