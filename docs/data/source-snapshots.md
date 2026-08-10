# Source Snapshots

## Purpose

Source snapshots preserve exactly what authoritative upstream systems published and exactly how MCGen normalized it. They are discovery evidence, not generated project templates and not proof that a compatibility tuple builds.

Every snapshot records its schema version, adapter identity, retrieval time, final response URL, media type, cache validators when available, byte count, SHA-256 response digest, normalized entries, rejected values, and warnings. New captures also retain the policy source ID, declared resource role, requested URL, and full approved redirect chain. Snapshot identity is derived from the adapter identity and ordered source digests. A repeated capture of unchanged bytes with the same adapter therefore has the same identity even though retrieval timestamps differ.

## Current Complete Capture

The current capture set is named by [`catalog/2026-08-10-r4/index.json`](../../catalog/2026-08-10-r4/index.json). It uses the thirteen unaffected `2026-08-10-r2` snapshots and the corrected Paper `2026-08-10-r4` snapshot. It contains 27,706 discovered entries, 20 explicit rejected records, and 1,019 response provenance records. The matching catalog represents every accepted entry and creates one structured coverage blocker for each rejected record.

| Adapter | Entries | Rejected | Source records |
| --- | ---: | ---: | ---: |
| Architectury | 1,130 | 0 | 5 |
| Bukkit | 37 | 0 | 1 |
| BungeeCord | 21 | 0 | 1 |
| Fabric | 6,866 | 0 | 8 |
| Forge | 8,390 | 1 | 7 |
| Gradle | 521 | 0 | 1 |
| Java | 887 | 18 | 911 |
| Kotlin | 204 | 0 | 2 |
| Mojang | 905 | 0 | 1 |
| NeoForge | 2,568 | 0 | 7 |
| Paper | 5,955 | 1 | 68 |
| Spigot | 82 | 0 | 1 |
| Sponge | 74 | 0 | 3 |
| Velocity | 66 | 0 | 3 |

The earlier `2026-08-10` captures and the superseded Paper `2026-08-10-r2` and `2026-08-10-r3` captures remain immutable historical evidence. They are not current catalog inputs. The count test covers both historical and current snapshots so an accidental mutation is visible in review.

## Forge Capture

The first Forge snapshot is [`sources/snapshots/forge/2026-08-09.json`](../../sources/snapshots/forge/2026-08-09.json). It uses:

- Mojang version manifest SHA-256 `380769b566afa9e768c82e1337fa3af3052aea47c7a9fe09d2c5a96edcef2e6c`.
- Forge Maven metadata SHA-256 `a77d717fdf878c11ef7dedb05bdebb02d1e756b6e1a48279489d26d6ad7ae220`.
- Adapter `forge-maven` version `1.0.2`.
- Snapshot identity `forge.a2da6567ebd0bf6f7978e735`.

The normalized result contains `5,033` exact `net.minecraftforge:forge` artifacts across `77` catalog keys. It classifies `5,023` release artifacts and `10` prerelease artifacts, and it has zero rejected artifacts. Catalog keys `1.4.0` and `1.7.10_pre4` are absent from the current Mojang manifest, so the adapter derives those strict historic keys from the official Forge coordinates, uses Forge evidence only for those entries, and records explicit warnings.

## Capture Command

Use an unused repository-relative output path:

```bash
npm run snapshot:forge -- --output sources/snapshots/forge/YYYY-MM-DD.json
```

The command uses at most eight concurrent requests with one 30 second timeout per source and the definition response limit. Each source definition names its primary, prerequisite, and corroborating resources. Each canonical source ID has a code owned exact HTTPS URL policy, approved media types, and redirect limit. The fetcher validates the initial URL and every redirect target before requesting it, follows redirects manually, and rejects undeclared hosts or paths, credentials, queries, fragments, nonstandard ports, protocol changes, malformed locations, redirect loops, and unexpected media types. It also rejects empty or unsuccessful responses, validates UTF-8, builds a deterministic normalized snapshot, validates it against the registered schema, and refuses to overwrite an existing file.

## Reconciliation Rules

Snapshots are immutable evidence. A later capture is additive by default. It may not automatically delete an earlier entry or replace a prior digest. Unexpected removals, new rejected values, response mutations, parser failures, empty responses, and large count changes require review before catalog reconciliation.

The committed snapshot currently proves source discovery only. ForgeGradle, Gradle, Java, mappings, recommendation policy, profile resolution, template generation, compilation, and artifact inspection remain separate evidence gates.

Phase 7 monitoring consumes these immutable snapshots as the baseline. Outages, empty responses, malformed responses, unexpected removals, and source mutations produce maintenance review or quarantine evidence as appropriate and never overwrite the last known good capture.
