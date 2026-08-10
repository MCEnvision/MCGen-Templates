# Deterministic Pack Construction

Phase 6 defines the pack as a content addressed archive with a generated `pack-manifest.json` entry. The implementation is in `src/pack-builder.ts` and deliberately accepts reviewed repository files as bytes. It does not read arbitrary paths, run build scripts, or include local state.

## Input contract

`buildPack` requires a semantic pack version, a forty character lowercase source commit, a fixed ISO timestamp, and an explicit list of relative files. Optional catalog, family revision, and profile revision values are recorded in the manifest. File paths must use normalized forward slash separators. Absolute paths, drive letter paths, parent segments, empty segments, duplicate paths, control characters, platform reserved names, oversized paths, and a caller supplied `pack-manifest.json` are rejected. The builder also bounds file count, individual file size, and total input bytes.

The input order does not affect the result. Files are sorted by their canonical paths and each manifest entry stores the SHA 256 digest of the exact bytes. The manifest groups the same entries into `schemas`, `families`, `profiles`, and `catalogs`, while `files` remains the complete inventory. Source references, fixtures, verification evidence, and other permitted release content remain in `files` when they do not belong to one of those groups.

## Archive contract

The archive is a stored ZIP with UTF 8 names, fixed DOS epoch metadata, fixed Unix file mode metadata, no comments, no extra fields, and deterministic central directory order. The generated manifest is added as the final sorted entry after the source files have been validated. The returned SHA 256 and SHA 512 values are calculated over the complete archive bytes. The builder reads the generated ZIP back, verifies every local header, CRC, path, and manifest digest, and rejects extra or missing entries. Rebuilding the same input produces byte identical archive bytes and digests.

The CLI uses a positive allowlist for schemas, sources, catalogs, profiles, templates, fixtures, approved documentation, and Phase 5 evidence. It rejects symlink components, credentials, caches, build output, logs, temporary Phase 6 output, and local paths. The output directory is written to a same filesystem staging directory and atomically renamed into place, so an interrupted build cannot leave a partial release directory. Callers must construct the file list from the approved pack allowlist and must run the repository validation gate before publication.

## SPDX inventory

`buildSpdxSbom` creates a deterministic SPDX 2.3 JSON document for the manifest file inventory and generated `pack-manifest.json`. It records one package for the pack, one SHA 256 checksum for each file, the fixed `CC0-1.0` data license, and `DESCRIBES` and `CONTAINS` relationships. `source-commit-manifest.json` separately binds every source digest to the exact source commit and pack version. The release workflow stores both manifests and the SBOM as separate release assets so they can be checked independently of the pack archive.

## Verification

The tests in `tests/pack-builder.test.ts` verify path rejection, duplicate rejection, deterministic ordering, byte identical archives, archive digest stability, manifest schema validation, SPDX schema validation, and archive readback. The CLI command is `phase6 pack --input <pack input> --output-dir <release directory>`. The input source commit must equal the checked out `HEAD`, so the workflow binds its ephemeral input to the exact checkout. The reviewed `verification/phase6/pack-input.example.json` is a schema fixture tied to the Phase 5 completion commit, not a mutable release input. The command emits the pack archive, SHA 256 and SHA 512 checksum files, source commit manifest, pack manifest, SPDX SBOM, and verification summary. Release publication must additionally rebuild from a clean checkout, compare archive bytes and digests, validate every manifest reference, and verify the uploaded archive, checksum files, SBOM, coverage, and verification summary against the source commit.

The `phase6 pack verification` workflow runs the repository gate and the example pack build on pull requests and approved `main` changes. It uploads only the bounded generated evidence directory with seven day retention. It does not publish a GitHub Release, create tags, or use a release credential. Release publication remains a later explicitly gated operation after the pack has been verified from the merged `main` commit.
