# Template Pack Releases

## Current Status

Phase 6 is complete. The implementation is merged and tagged as `phase-6-pack-publication`, and the first immutable semantic pack release [`v1.0.0-beta.1`](https://github.com/MCEnvision/MCGen-Templates/releases/tag/v1.0.0-beta.1) is published as a prerelease from main commit `99c6f8d5772bde176ac6358214933efbf8286199`. The [phase 6 release verification record](../verification/phase6-release.md) contains the exact asset list, digests, coverage binding, offline verification, attestations, and rollback evidence.

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

The release remains a draft until every asset is generated from the same merged commit, verified, uploaded, and cross-checked. The `v1.0.0-beta.1` release passed this gate and is immutable.

## Release Gate

Before publication:

1. Validate descriptors, schemas, profiles, conditions, catalog shards, and coverage.
2. Rebuild the pack and prove deterministic digests.
3. Generate minimal and maximum-customization fixtures for every affected family and profile.
4. Build every tuple advertised as Verified or Legacy Verified.
5. Inspect packaged metadata, entrypoints, resources, icons, mixins, access files, versions, and artifact names.
6. Verify the signed tag targets the approved merged `main` commit.
7. Generate checksums, source manifest, SBOM, and supported attestations.
8. Publish the immutable release through the tag only release workflow.
9. Download every remote asset and run `node scripts/verify-pack-offline.mjs` without network access.
10. Verify all assets, links, attestations, catalog references, and offline retrieval after publication.

## Rollback and Revocation

Do not rewrite or reuse a published tag. A defective release is marked unsafe in the catalog and release notes, then superseded by a new release. Clients retain explicit pins but must receive a clear warning or block when a security or supply-chain issue requires it.

Artifact mutation or missing upstream content quarantines affected tuples without deleting historical evidence.

## Release workflow

Create and push a signed annotated semantic version tag only after the approved `main` commit contains the release workflow. The workflow accepts an existing tag, checks that GitHub reports its annotated tag signature as valid, builds from two clean checkouts, and compares every generated release document before publication. It creates a draft release, attests the archive, uploads the archive and evidence, downloads the remote assets, runs the offline verifier, and publishes the draft only after those checks pass. A failed publication leaves the draft and the existing release history unchanged.
