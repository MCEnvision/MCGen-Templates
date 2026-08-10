# Phase 6 Release Verification

Phase 6 is complete. The first immutable semantic template pack release is [`v1.0.0-beta.1`](https://github.com/MCEnvision/MCGen-Templates/releases/tag/v1.0.0-beta.1), published from the verified signed annotated tag on main commit `99c6f8d5772bde176ac6358214933efbf8286199`.

## Release identity

- Release: [`v1.0.0-beta.1`](https://github.com/MCEnvision/MCGen-Templates/releases/tag/v1.0.0-beta.1)
- Release API record: [`367986589`](https://api.github.com/repos/MCEnvision/MCGen-Templates/releases/367986589)
- Source commit: `99c6f8d5772bde176ac6358214933efbf8286199`
- Catalog snapshot: `2026-08-10-r4`
- Release state: published, prerelease, immutable
- Release workflow run: [`31398841573`](https://github.com/MCEnvision/MCGen-Templates/actions/runs/31398841573)

The tag is an annotated tag signed by EnVy with the registered EnVisione SSH key. GitHub reports the tag signature as verified and the release workflow verifies that the tag points to the current main commit before building.

## Published assets

The release contains exactly these assets.

```text
coverage.json
mcgen-template-pack.zip
mcgen-template-pack.zip.sha256
mcgen-template-pack.zip.sha512
pack-manifest.json
release-notes.md
rollback-test.json
source-commit-manifest.json
spdx-sbom.json
verification-summary.json
```

The archive is 56,952,726 bytes. Its SHA-256 digest is `9ce3fd335bc24cc4e4a24d0016195d64ecc0f92658893e3c43167d5da7cbaa28`. Its SHA-512 digest is `6f3a68c41855912ac35d7a58072382cc3db727492a9ddecc15592906f870806618852e67ada3ca3c2732eca927253a1545f54e284dccc10cc6b214e75639f93f`.

The release coverage envelope binds the archived Phase 5 coverage summary to pack version `1.0.0-beta.1`, source commit `99c6f8d5772bde176ac6358214933efbf8286199`, catalog snapshot `2026-08-10-r4`, and coverage digest `6bb72f74455593b68320535489acd58d72f47a534e7967ad6629bb7457158434`. It reports two verified Spigot tuples and no unresolved coverage.

## Verification evidence

The release workflow completed successfully with both clean checkout candidates producing byte identical pack archives and matching manifests, checksums, coverage, and SBOMs. It validated the source commit manifest, SPDX inventory, archive structure, CRCs, paths, bounds, catalog index and shard digests, profile identities, tuple evidence, coverage bindings, and exact asset set.

After publication, all ten assets were downloaded from GitHub. The offline verifier passed without contacting upstream sources and reported:

```text
offline pack verified 1.0.0-beta.1 99c6f8d5772bde176ac6358214933efbf8286199 9ce3fd335bc24cc4e4a24d0016195d64ecc0f92658893e3c43167d5da7cbaa28
```

GitHub artifact attestations verify for both `mcgen-template-pack.zip` and `spdx-sbom.json`. The rollback simulation corrupts an archive byte, detects the mutation, quarantines the candidate, and preserves the prior release. Published tags and assets are never rewritten or replaced.

## Consumer procedure

Consumers should download all release assets from the pinned release URL, verify the SHA-256 or SHA-512 checksum, inspect the source commit manifest and SPDX SBOM, and run `node scripts/verify-pack-offline.mjs --dir <download-directory> --require-release-evidence` when repository tooling is available. The pack is usable without network access after download. Coverage and verification records remain the authority for distinguishing verified, discovered, and blocked boundaries.

## Reproduction and recovery

The tag-only release workflow is at `.github/workflows/phase6-release.yml`. It accepts only an existing semantic tag, requires a verified annotation, checks that the tag targets main, builds from two clean checkouts, and publishes only after the offline and remote gates pass. A failed candidate remains unpublished. A defective published release receives a new semantic version and corrective evidence; the existing immutable tag and assets remain available for audit and rollback.
