# Phase 4 Contract Verification

Phase 4 is active on `envy/phase_4_profiles_templates` from the merged and tagged Phase 3 `main` commit. It is not complete until its pull request merges, post merge checks pass, the project and issues are reconciled, and the signed `phase-4-profiles-templates-customization` tag identifies the merged commit.

The local gate is:

```bash
npm ci
npm run verify
npm audit --audit-level=high
git diff --check origin/main...HEAD
```

Focused tests cover profile and descriptor schema registration, exact profile resolution and explicit blockers, Simple and Advanced mode preservation, arbitrary project versions, metadata serialization, PNG signature, CRC, dimension, pixel, and size checks, safe file operations, raw override preservation, path collision rejection, and deterministic virtual file tree digests. Canonical JSON validation scans `profiles/`, `templates/`, `fixtures/`, `sources/`, and `catalog/`.

Phase 4 does not run generated Gradle, Maven, Java, Kotlin, or shell content. It validates and renders contracts only. Exact tuple compilation, artifact inspection, and complete compatibility build evidence remain later phase gates.
