# Phase 4 Contract Verification

Phase 4 is complete on `main`. Pull request [29](https://github.com/MCEnvision/MCGen-Templates/pull/29) merged at commit `7f9853e6b8277aea0518d9f446c9b4d70e0acd22`, issue [19](https://github.com/MCEnvision/MCGen-Templates/issues/19) is closed, and the signed annotated tag `phase-4-profiles-templates-customization` identifies the approved completion commit.

The local gate is:

```bash
npm ci
npm run verify
npm audit --audit-level=high
git diff --check origin/main...HEAD
```

Focused tests cover profile and descriptor schema registration, exact profile resolution and explicit blockers, Simple and Advanced mode preservation, arbitrary project versions, metadata serialization, PNG signature, CRC, dimension, pixel, and size checks, safe file operations, raw override preservation, path collision rejection, and deterministic virtual file tree digests. Canonical JSON validation scans `profiles/`, `templates/`, `fixtures/`, `sources/`, and `catalog/`.

Phase 4 does not run generated Gradle, Maven, Java, Kotlin, or shell content. It validates and renders contracts only. Exact tuple compilation, artifact inspection, and complete compatibility build evidence remain Phase 5 gates.

## Merged evidence

The merged Phase 4 implementation contains 12 reviewed family descriptors and profile boundaries, Simple and Advanced customization contracts, arbitrary project version handling, metadata render targets, PNG validation and binary asset insertion, safe raw file operations, deterministic descriptor rendering, and explicit blockers for profile boundaries that require later catalog or build evidence. The completion gate passed with 16 test files and 91 tests, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run validate` with 9,264 canonical documents, `npm audit --audit-level=high` with zero vulnerabilities, and `git diff --check`.

The implementation intentionally does not claim that a discovered catalog component is a build verified tuple. Phase 5 owns fixture generation, exact JDK and wrapper execution, compilation, artifact inspection, reproducibility, and tuple evidence.
