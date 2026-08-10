# Template Pack Contract Verification

## Scope

This gate verifies the versioned serialized contracts, deterministic utility layer, authoritative source adapters, and canonical source snapshots. It does not mark a template family or compatibility tuple verified.

## Local Gate

Run from the repository root with Node.js 22:

```bash
npm ci
npm run verify
git diff --check
```

`npm run verify` must pass formatting, ESLint, TypeScript type checking, unit tests, compilation, and canonical JSON Schema validation. The dependency audit must report no known vulnerabilities.

Source-network contract tests must prove that approved canonical requests and redirects succeed, while undeclared, internal, credentialed, downgraded, path-changing, and excessive redirect targets fail before the rejected target is requested.

## Snapshot Gate

For every source snapshot:

1. Verify each response digest and final response URL against the capture evidence.
2. Validate the snapshot through `npm run validate`.
3. Confirm entries are deterministically sorted and coordinates are unique.
4. Confirm every source index resolves to a recorded source.
5. Review every rejected value and warning.
6. Compare upstream entry and catalog-key counts with the prior snapshot.
7. Never delete prior evidence because a current request failed or returned less data.

The first Forge snapshot passes with `5,033` exact artifacts, `77` catalog keys, zero rejected artifacts, and two documented Forge-only historic catalog-key warnings.

The current complete capture and catalog are `2026-08-10-r4`. The fourteen current snapshots contain `27,706` accepted entries and `20` rejected records. The catalog contains `2,540` content addressed shards, represents every accepted entry, and assigns one exact blocker to every rejected record. `tests/committed-snapshot-counts.test.ts` pins the entry, rejection, and provenance-record counts for every historical and current committed snapshot.

## Required GitHub Checks

The phase pull request must pass:

- `quality / documentation`.
- `quality / secret scan`.
- `quality / node`.
- `quality / dependency review` when the event and actor support it.
- `label changed paths`.
- CodeQL analysis for GitHub Actions and JavaScript or TypeScript.

Only checks observed successfully on this repository may become required ruleset checks.

## Completion Boundary

Passing this gate means the contracts and Forge discovery evidence are internally valid and reproducible. It does not prove a generated Forge project, recommend an exact Forge build, or satisfy complete compatibility coverage.
