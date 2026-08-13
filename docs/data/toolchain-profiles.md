# Toolchain Profiles

Toolchain profiles are reviewed compatibility boundaries between the Phase 3 catalog and a template family. A profile never selects an unbounded latest value and never turns a discovered catalog component into a verified build tuple.

Each profile records its family and platform, catalog snapshot and shard selectors, exact component constraints, Java runtime and bytecode requirements, wrapper and checksum, build plugins and repositories, mappings strategy, metadata renderer, source and resource roots, supported languages and adapters, optional capabilities, incompatibilities, verification commands, artifact inspection patterns, fallback behavior, and evidence references. A profile can be `reviewed` or `blocked`. A blocked profile remains visible with an evidence based reason rather than silently disappearing.

Language and build capabilities use three independent arrays. `sourceLanguages` contains `java` and only includes `kotlin` when a real Kotlin source template and platform runtime adapter pass exact verification. `buildSystems` contains executable build families. `gradleDsls` contains the supported Groovy and Kotlin Gradle syntaxes. The previous `languages` and `build.dsl` profile fields were ambiguous and are not capability contracts.

Phase 14 verifies Java and Kotlin source with Groovy and Kotlin Gradle DSL for Bukkit, BungeeCord, Fabric, Paper modern and traditional, Spigot default, legacy, and modern, Sponge, and Velocity. Each advertised Cartesian combination has two isolated successful builds, artifact inspection, byte reproducibility, and output tree reproducibility evidence under `verification/phase5/evidence/`. Plugin and proxy Kotlin builds use Kotlin JVM `1.9.24` and package the Kotlin runtime in the generated artifact. Fabric Kotlin uses `net.fabricmc:fabric-language-kotlin:1.10.20+kotlin.1.9.24`.

Forge legacy and modern, NeoForge, Architectury, and multiloader remain Java with Groovy DSL. Those profiles do not advertise Kotlin or Kotlin DSL because this release has no reviewed platform adapter, metadata, multiloader topology, and exact build evidence for those combinations. Modern Forge contains no Fabric Language Kotlin adapter.

Profile resolution is exact. A resolver returns one matching profile, an explicit blocker when no profile matches, or an ambiguity error when more than one profile matches. It never guesses from a nearby version, an API line, a latest selector, or an inferred Cartesian product. Build execution and artifact verification remain a later phase responsibility.

The profile schema is [`schemas/toolchain-profile.schema.json`](../../schemas/toolchain-profile.schema.json). Profile instances live under `profiles/` and are validated as canonical JSON. The matching descriptor contract is documented in [Template Families](../architecture/template-families.md).
