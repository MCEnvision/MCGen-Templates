# MCGen Templates

MCGen Templates is the canonical public source for the versioned template pack and compatibility catalog used by MCGen.

The repository is currently in its planning and bootstrap stage. No template pack or machine readable catalog has been published yet.

## Repository Model

The `main` branch is the canonical release source. Its initial bootstrap commit contains only this README and the [active project plan](docs/general/plan.md).

MCGen will not create one Git branch per Minecraft version, API line, loader build, or generated project. Template content will live in a small set of reusable platform families on `main`. Typed descriptors, conditional files, boundary fragments, toolchain profiles, and dynamic version resolvers will produce the requested project from one pinned template-pack release.

The target remains complete official coverage. The compatibility catalog will expose every Minecraft or API version and every exact compatible loader, mappings, build-plugin, wrapper, language-adapter, and toolchain version supported by authoritative upstream evidence. Versions are catalog data, not repository branches.

Template-pack releases will be pinned by semantic version, signed tag, source commit, schema version, and content digest. Generated projects will also record the resolved template family, profile, catalog snapshot, and exact component tuple. Ordinary `envy/phase_*` branches remain temporary development branches for reviewed pull requests only.

## Current Status

Architecture and implementation work are defined in the active plan. Template families, descriptors, catalog files, resolvers, schemas, fixtures, workflows, contribution policies, and supporting documentation will be introduced through approved phase branches and pull requests.
