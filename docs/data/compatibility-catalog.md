# Compatibility Catalog

## Purpose

The compatibility catalog is generated only from committed immutable source snapshots. It makes every observed exact component visible without treating metadata discovery as proof that a generated project compiles.

The catalog owns discovered components, source evidence, release channels, catalog keys, documented compatibility edges, coverage, and known blockers. Template families, toolchain profiles, generated project fixtures, build records, and artifact inspections remain separate inputs. A catalog shard may exist without a family or profile binding so an upstream version never disappears merely because MCGen has not yet implemented its development environment.

## Layout

```text
catalog/index.json
catalog/recommendation-policy.json
catalog/coverage.json
catalog/platforms/<platform>/index.json
catalog/platforms/<platform>/<key>.<sha256>.json
```

The current catalog is [`catalog/2026-08-10-r2/index.json`](../../catalog/2026-08-10-r2/index.json). It contains 2,540 immutable shards from fourteen current source snapshots. Its coverage report represents 22,052 accepted entries and records 86 rejected records as exact structured blockers.

The root index names every immutable source snapshot by repository path and canonical document digest. It maps each platform to a small platform index. A platform index maps each Minecraft or API key to a shard path, exact digest, byte length, and source snapshot set. Shard filenames include their digest so a changed catalog can add a new shard without rewriting historical evidence.

Each shard contains only observed exact components and directly evidenced edges. A `targets` edge connects the selected Minecraft or API key to one exact component. A global shard uses the key `all` and has no target edge because an independently discovered tool component is not proof of Minecraft compatibility. The catalog does not connect every loader, mapping, Gradle plugin, Java version, or API build to every other component. Such a tuple requires a later profile or verification record with explicit intersection evidence.

## Source Evidence and Coverage

Each catalog component retains one or more source entry references. A reference identifies the immutable source snapshot, normalized entry index, and contributing source-record indexes. `catalog/coverage.json` lists every accepted source entry with one of two dispositions:

- `represented`, with the exact shard identifier.
- `blocked`, with a structured blocker identifier, reason, and evidence.

An unexplained accepted-entry gap is a validation failure. Catalogs generated with rejection accounting version `1` also require one structured blocker for every rejected source record, preserving its exact snapshot, rejected-record index, source-record index, parser reason, and evidence. Earlier immutable catalog revisions remain readable as legacy accepted-entry coverage, but current generation always writes rejection accounting version `1`.

## Recommendation Policy

The policy document is versioned independently from catalog data. Simple-mode recommendations require a stable release channel and tuple-specific `verified` or `legacy-verified` status. An official upstream recommendation marker ranks eligible tuples first, but it does not make an unverified tuple eligible. If no eligible tuple exists, the deterministic result is no recommendation with an explicit unresolved profile or verification blocker.

Advanced mode may display every discovered catalog component. A manual value remains outside catalog evidence and is `custom-unverified` until it matches a catalog record and its tuple resolves.

## Additive Drift

Catalog drift compares a baseline snapshot set with a candidate snapshot set using exact platform, component, catalog-key, and coordinate identities. New entries are additions. Missing entries and changed source response digests require review; they never remove existing catalog content automatically. Source metadata cannot by itself prove that a binary artifact changed, so any suspected artifact mutation remains quarantined until artifact-specific evidence is captured.
