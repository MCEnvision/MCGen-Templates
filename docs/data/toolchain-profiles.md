# Toolchain Profiles

Toolchain profiles are reviewed compatibility boundaries between the Phase 3 catalog and a template family. A profile never selects an unbounded latest value and never turns a discovered catalog component into a verified build tuple.

Each profile records its family and platform, catalog snapshot and shard selectors, exact component constraints, Java runtime and bytecode requirements, wrapper and checksum, build plugins and repositories, mappings strategy, metadata renderer, source and resource roots, supported languages and adapters, optional capabilities, incompatibilities, verification commands, artifact inspection patterns, fallback behavior, and evidence references. A profile can be `reviewed` or `blocked`. A blocked profile remains visible with an evidence based reason rather than silently disappearing.

Profile resolution is exact. A resolver returns one matching profile, an explicit blocker when no profile matches, or an ambiguity error when more than one profile matches. It never guesses from a nearby version, an API line, a latest selector, or an inferred Cartesian product. Build execution and artifact verification remain a later phase responsibility.

The profile schema is [`schemas/toolchain-profile.schema.json`](../../schemas/toolchain-profile.schema.json). Profile instances live under `profiles/` and are validated as canonical JSON. The matching descriptor contract is documented in [Template Families](../architecture/template-families.md).
