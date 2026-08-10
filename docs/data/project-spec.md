# Project Specification and Customization

The project specification is the portable input shared by Simple mode, Advanced mode, the future CLI, the future API, and the future web application. It captures user intent without credentials or executable instructions.

The specification contains the selected template, mode, project identity, platform and exact catalog components, metadata, build settings, repositories, dependencies, source layout, features, assets, publishing settings, repository settings, target overrides, file operations, extensions, dormant values, and provenance. Project versions are independent from Minecraft versions and may use alpha, beta, release candidate, snapshot, build metadata, or other syntactically valid custom suffixes.

Simple mode exposes the safe common fields and catalog recommendations. Advanced mode exposes every descriptor field, exact component selection, structured Gradle or Maven settings, metadata extensions, and raw text operations. Switching modes never discards explicit or dormant values. Raw build overrides are preserved as `custom-unverified` and are never executed by canonical repository verification.

The specification schema is [`schemas/project-spec.schema.json`](../../schemas/project-spec.schema.json). PNG assets use [`schemas/asset-png.schema.json`](../../schemas/asset-png.schema.json) and are checked as binary input before they are mapped to metadata destinations. Safe file operations use [`schemas/file-operation.schema.json`](../../schemas/file-operation.schema.json) and reject absolute paths, traversal, NUL bytes, duplicate paths, and case folded collisions.
