# Failure Recovery

Maintenance failures are classified before recovery is attempted.

- Network outages and transient network failures use bounded retry and preserve the baseline while retries remain.
- Empty responses, malformed responses, source policy failures, unsupported JDKs, profile mismatches, template defects, upstream defects, and test infrastructure failures are recorded for review or quarantine.
- Bulk removals and artifact mutations quarantine the candidate and block publication.
- A missing or changed artifact invalidates affected tuple evidence without deleting historical evidence.

Recovery records include the exact scenario, attempt count, sanitized reason, affected coordinates and tuples, preserved baseline, recovery steps, and whether publication remains blocked. Corrective work creates a new signed commit, snapshot, catalog revision, or immutable release. Published tags and releases are never rewritten.

Use the phase 7 recovery command for deterministic simulations and retain its JSON output with the review evidence. See [phase 7 maintenance verification](../verification/phase7-maintenance.md).
