# Template Families

Template families are descriptor driven structural boundaries. They are not branches for individual Minecraft versions, API lines, loader builds, or generated projects. Catalog data supplies exact versions while a family supplies reusable files, conditional fragments, metadata mappings, source layouts, capability declarations, and profile references.

The Phase 4 family set covers Forge legacy and modern boundaries, NeoForge, Fabric, Architectury and configurable multiloader, Bukkit, Spigot, Paper traditional and modern metadata models, Sponge, Velocity, and BungeeCord. A new family is justified only by a real structural boundary such as a metadata format, build plugin model, Java requirement, source layout, run configuration, or multiloader topology. A new exact upstream component updates catalog data instead of copying a family.

Descriptors are data only. Conditions use a bounded expression contract and cannot access the network, filesystem, process, reflection, credentials, or arbitrary code. Each field has type, default policy, mode visibility, validation, ordering, and exact render mappings. Each file has a safe source and destination, renderer, conditional inclusion, and raw override policy. PNG slots declare dimensions, size, and output destinations.

The descriptor schema is [`schemas/template-descriptor.schema.json`](../../schemas/template-descriptor.schema.json). Simple and Advanced behavior is captured by [`schemas/customization-contract.schema.json`](../../schemas/customization-contract.schema.json) and [`schemas/field-metadata.schema.json`](../../schemas/field-metadata.schema.json). The renderer produces a virtual file tree. Filesystem, ZIP, GitHub, and build execution adapters are outside this repository phase.
