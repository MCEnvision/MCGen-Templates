# Template Pack Architecture

## Design Goal

MCGen Templates must represent complete loader and Minecraft version coverage without copying a project tree into hundreds of Git branches. It uses descriptor-driven template families, catalog data, compatibility profiles, and deterministic rendering.

## Canonical Layers

Generated content resolves in this order:

```text
category base
platform family
minecraft or api boundary fragment
toolchain profile
exact catalog tuple values
project specification
raw file operations
```

The first four layers are reviewed template-pack content. Exact component versions are catalog data. Project configuration and raw operations are user input.

## Template Descriptor

Each family has one versioned descriptor. It defines stable property IDs, types, labels, help, ordering, defaults, validation, visibility, inheritance, derivation, catalog resolvers, compatibility conditions, file destinations, inclusion conditions, asset slots, structured render targets, raw override behavior, and presentation metadata for Simple and Advanced modes.

Descriptors are data. They cannot execute code, start processes, access credentials, read arbitrary filesystem paths, or contact the network.

## Compatibility Catalog

The catalog is a normalized graph of Minecraft versions, platforms, loaders, APIs, mappings, build plugins, wrappers, Java versions, language adapters, template families, profiles, and verification evidence.

Every edge records whether its relationship is published, documented, verified, or inferred. Inferred relationships may be exposed only as Advanced experimental choices and cannot drive Simple-mode recommendations.

The catalog is split into content-addressed shards so clients load only the selected platform and compatibility key. Clients verify shard digests before parsing.

## Toolchain Profiles

Profiles describe structural and build constraints that cannot be represented by one version string. A profile owns:

- Platform and catalog-key ranges.
- Exact compatible component ranges.
- JDK and Java bytecode targets.
- Gradle or Maven wrapper and checksum.
- Build plugins and repositories.
- Mappings strategy.
- Metadata renderer.
- Source and resource layout.
- Supported languages and features.
- Verification commands and artifact inspections.
- Known incompatibilities and migration profile.

Profiles never emit mutable `latest` selectors into generated build files.

## Version Source Adapters

Source adapters fetch authoritative upstream metadata outside generator core. Each fetch records adapter version, request URL, retrieval time, cache validators, media type, response digest, parser schema, normalized entry count, warnings, and rejected entries.

Metadata fetching is a privileged maintenance boundary. Repository-owned source definitions select inputs, while code-owned network policies bind each source ID to exact HTTPS URLs and a redirect limit. The fetcher validates the initial URL and every redirect target before access, follows redirects manually, and rejects undeclared hosts or paths, credentials, queries, fragments, nonstandard ports, protocol changes, malformed locations, and redirect loops. User configuration cannot add a source URL.

An outage retains the last-known-good snapshot and marks it stale. Empty responses, parser failures, unexpected removals, or artifact mutations never delete catalog data automatically.

The implemented Forge adapter uses the Mojang version manifest as catalog-key corroboration and official Forge Maven metadata as primary discovery. It retains every exact Forge artifact. Strict historic Forge keys missing from the current Mojang manifest remain discoverable from their official Forge coordinate and carry an explicit warning instead of being discarded.

Source snapshots contain response URLs after redirects, retrieval timestamps, media types, cache validators when supplied, byte counts, SHA-256 digests, adapter identity, normalized entries, rejected values, and warnings. Snapshot identity depends on adapter identity and ordered source digests, not retrieval time.

## Generator Boundary

The future generator core receives a pinned pack, catalog snapshot, resolved tuple, validated project specification, and asset resolver. It returns a virtual file tree and performs no filesystem, GitHub, browser, or network effects.

Output adapters own ZIP packaging, local filesystem writes, API responses, and GitHub commits. The GitHub adapter creates a complete tree and one commit before creating a target reference.

## Versioning

Pack releases use semantic versions, signed annotated tags, source commits, schema versions, and content digests. Generated projects record the pack, family, profile, catalog snapshot, exact tuple, project specification, assets, and final files by digest.

Schema migrations are explicit and pure. Historical releases and evidence remain available for reproducibility.
