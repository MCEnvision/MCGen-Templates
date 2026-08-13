# Project Specification and Customization

## Version 3 Language and Build Selection

ProjectSpec version 3 separates the generated source language from the build system and Gradle file syntax:

```json
{
  "$schema": "urn:mcgen:schema:project-spec:3",
  "schemaVersion": 3,
  "template": {
    "id": "fabric",
    "sourceLanguage": "kotlin"
  },
  "build": {
    "system": "gradle",
    "gradleDsl": "kotlin"
  }
}
```

`template.sourceLanguage` is either `java` or `kotlin`. `build.system` is either `gradle` or `maven`. `build.gradleDsl` is required for Gradle and is either `groovy` or `kotlin`; it is forbidden for Maven.

The deterministic version 1 migration selects Java source, preserves the existing build system, translates `build.dsl` to `build.gradleDsl`, and defaults missing Gradle DSL to Groovy. It removes the legacy `build.dsl` field so the resolved document has one authoritative value.

Recommended identity values keep their user lock state in an optional `recommendationLocks` map. Keys are bounded field paths such as `project.groupId`, `project.artifactId`, `project.package`, or `project.mainClass`, and values are booleans. Import, export, migration, and Simple or Advanced mode switches preserve this map exactly. A version 1 document without locks migrates to an empty map.

The project specification is the portable input shared by Simple mode, Advanced mode, the future CLI, the future API, and the future web application. It captures user intent without credentials or executable instructions.

The specification contains the selected template, mode, project identity, platform and exact catalog components, metadata, build settings, repositories, dependencies, source layout, features, assets, publishing settings, repository settings, target overrides, file operations, extensions, dormant values, and provenance. Project versions are independent from Minecraft versions and may use alpha, beta, release candidate, snapshot, build metadata, or other syntactically valid custom suffixes.

Simple mode exposes the safe common fields and catalog recommendations. Advanced mode exposes every descriptor field, exact component selection, structured Gradle or Maven settings, metadata extensions, and raw text operations. Switching modes never discards explicit or dormant values. Raw build overrides are preserved as `custom-unverified` and are never executed by canonical repository verification.

The specification schema is [`schemas/project-spec.schema.json`](../../schemas/project-spec.schema.json). PNG assets use [`schemas/asset-png.schema.json`](../../schemas/asset-png.schema.json) and are checked as binary input before they are mapped to metadata destinations. Safe file operations use [`schemas/file-operation.schema.json`](../../schemas/file-operation.schema.json) and reject absolute paths, traversal, NUL bytes, duplicate paths, and case folded collisions.
