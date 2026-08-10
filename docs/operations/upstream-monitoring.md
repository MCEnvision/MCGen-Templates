# Upstream Monitoring

MCGen Templates monitors the fourteen registered authoritative source adapters without changing the last known good repository state. Each resource is fetched under the existing code owned network policy, normalized with its adapter version, and compared with the immutable baseline snapshot.

An unchanged source produces no maintenance proposal. New entries under an existing catalog key produce an additive proposal. A new key, changed source digest, removal, unexpected rejection, source host change, or artifact mutation requires review. A source outage never removes old entries and never creates a partial candidate catalog.

The monitor records the requested source identity, baseline and candidate digests, normalized coordinate deltas, retry state, affected tuples, and the publication block. See [phase 7 maintenance verification](../verification/phase7-maintenance.md) for the exact JSON contracts and commands.

Scheduled maintenance is read only. A maintainer reviews the generated plan and pull request manifest, runs the affected profile and tuple verification, and merges any accepted update through the normal signed pull request process. The manifest is a local contract only. It declares `remoteWrites` as false and `githubAppDeferred` as true, so no scheduled job can create a branch, pull request, or merge remotely.
