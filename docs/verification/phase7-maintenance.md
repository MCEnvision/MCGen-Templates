# Phase 7 Maintenance Verification

## Status

Phase 7 is in progress on the maintenance branch and is tracked by [issue 25](https://github.com/MCEnvision/MCGen-Templates/issues/25). The first immutable beta release is already verified. This record describes the deterministic maintenance contracts that must pass before the final repository complete gate is claimed.

## Contracts

The maintenance surface is split into immutable JSON documents.

- `monitor-run` records one adapter observation, its baseline and candidate snapshots, complete deltas, bounded retry state, and publication policy.
- `quarantine-record` preserves a deterministic failure and blocks publication without deleting the last known good snapshot, catalog, or release.
- `maintenance-plan` classifies a reviewed update as a proposal, review, retry, quarantine, or preservation action and records the affected coordinates, tuples, and invalidation scope.
- `maintenance-audit` reports all twenty repository completion requirements individually. A missing profile, tuple, security, GitHub, or documentation gate remains an explicit blocker.
- `maintenance-recovery` records the required addition, boundary, outage, malformed response, bulk removal, mutation, retry, template failure, and historical rebuild simulations.

Plan and monitor identities are content addressed. Invocation time is evidence metadata and is excluded from the identity digest. Baseline snapshots, catalogs, coverage, evidence, and releases are immutable. A partial source run cannot create a candidate catalog.

## Commands

Build the tool and run the contracts with repository relative paths:

```bash
npm ci
npm run verify
node dist/cli.js phase7 monitor --input verification/phase7/monitor-input.json --output verification/phase7/monitor-run.json
node dist/cli.js phase7 quarantine --input verification/phase7/monitor-run.json --output verification/phase7/quarantine-record.json
node dist/cli.js phase7 plan --input verification/phase7/maintenance-input.json --output verification/phase7/maintenance-plan.json
node dist/cli.js phase7 audit --input verification/phase7/audit-input.json --output verification/phase7/repository-audit.json
node dist/cli.js phase7 audit-live --output verification/phase7/github-audit.json
node dist/cli.js phase7 invalidation --input verification/phase7/monitor-run.json --evidence-dir verification/phase5/evidence --output verification/phase7/invalidation-plan.json --shard-count 4
node dist/cli.js phase7 proposal --input verification/phase7/maintenance-plan.json --output verification/phase7/maintenance-proposal.json
node dist/cli.js phase7 recovery --scenario new-component --output verification/phase7/recovery-new-component.json
```

The `phase7:monitor`, `phase7:quarantine`, `phase7:plan`, `phase7:audit`, `phase7:audit-live`, `phase7:invalidation`, `phase7:proposal`, and `phase7:recovery` npm scripts build the CLI before invoking the corresponding command. A scheduled run must pass an explicit `--generated-at` value for reproducible audit evidence.

`phase7 audit-live` derives the repository from `origin`, performs only read-only `gh api` requests, and records the exact API paths and repository paths used as evidence. It computes capability states from observed responses and local files. It does not accept caller supplied pass or fail booleans, create or update GitHub objects, publish changes, or infer a missing capability as complete. A denied or unavailable API response remains an explicit `blocked` capability in the resulting `github-audit` document.

`phase7 invalidation` matches changed source digests against the source digests recorded by phase 5 tuple evidence and creates bounded invalidation queue plans. `phase7 proposal` creates a content addressed, deduplicated maintenance pull request proposal with exact deltas, verification commands, review requirements, and rollback references. Neither command publishes or auto merges a change.

## Safe maintenance policy

Only network outages and transient network failures are retryable. Retry counts and backoff are bounded. Empty, malformed, removed, mutated, unsupported, or deterministic build inputs are quarantined. Additions under an existing catalog key may be proposed, while new compatibility boundaries require review. Removals preserve the baseline and require a reviewed maintenance pull request. No maintenance command auto merges, overwrites an immutable document, or publishes from partial evidence.

## Required evidence

The phase 7 workflow runs the full repository verification, creates a read only monitor observation, executes the recovery simulations, and produces a repository audit artifact. The audit must show all twenty requirements as passed before issue 25 and its Project item can be marked done. Until then, the workflow and this document must report the exact blocker rather than implying final completion.
