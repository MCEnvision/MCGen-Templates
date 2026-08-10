# MCGen Templates

MCGen Templates is the canonical public source for the versioned template pack and compatibility catalog used by MCGen.

The repository is in its foundation stage. No template pack, compatibility catalog, or generated-project tooling has been published yet.

MCGen will provide reusable Minecraft project generation for mods, plugins, proxies, and multiloaders without requiring an IDE. This repository owns only the first-party template pack, compatibility evidence, toolchain profiles, fixtures, and pack verification. The future `MCEnvision/MCGen` repository will own the website, API, CLI, generator library, GitHub App, and production deployment.

## Repository Model

The `main` branch is the canonical release source. Its initial bootstrap commit contains only this README and the [active project plan](docs/general/plan.md).

MCGen will not create one Git branch per Minecraft version, API line, loader build, or generated project. Template content will live in a small set of reusable platform families on `main`. Typed descriptors, conditional files, boundary fragments, toolchain profiles, and dynamic version resolvers will produce the requested project from one pinned template-pack release.

The target remains complete official coverage. The compatibility catalog will expose every Minecraft or API version and every exact compatible loader, mappings, build-plugin, wrapper, language-adapter, and toolchain version supported by authoritative upstream evidence. Versions are catalog data, not repository branches.

Template-pack releases will be pinned by semantic version, signed tag, source commit, schema version, and content digest. Generated projects will also record the resolved template family, profile, catalog snapshot, and exact component tuple. Ordinary `envy/phase_*` branches remain temporary development branches for reviewed pull requests only.

## Planned Coverage

The catalog is intended to represent every officially discoverable compatible version for:

- Forge.
- NeoForge.
- Fabric.
- Architectury and configurable multiloaders.
- Bukkit.
- Spigot.
- Paper.
- Sponge.
- Velocity.
- BungeeCord.

Coverage is evidence-driven. A version remains visible with its exact status when it is discovered but not yet reproducible. MCGen will not silently omit a known upstream version or label an untested tuple as verified.

## Repository Layout

The planned implementation layout is:

```text
templates/    Descriptor-driven template families and conditional files.
catalog/      Compatibility keys, exact component tuples, profiles, and evidence.
schemas/      Versioned descriptor, catalog, profile, and evidence schemas.
sources/      Authoritative source-adapter definitions and fixtures.
fixtures/     Deterministic minimal and maximum-customization generation cases.
docs/         Architecture, security, contribution, verification, and release guidance.
```

These implementation directories will be added only through approved phase pull requests.

## Development

The current branch contains documentation and GitHub foundation files only. Until the first implementation manifest is added, use:

```bash
git diff --check
git status --short
git ls-files
```

Future setup, validation, generation, and release commands will be documented from the checked-in toolchain rather than guessed in advance.

## Documentation

- [Documentation index](docs/README.md)
- [Technical overview](docs/general/documentation.md)
- [Active plan](docs/general/plan.md)
- [Contribution guide](docs/general/contributing.md)
- [Security policy](.github/SECURITY.md)
- [Issue tracker](https://github.com/MCEnvision/MCGen-Templates/issues)
- [Wiki](https://github.com/MCEnvision/MCGen-Templates/wiki)

## Current Status

The GitHub foundation is the active gate. Template families, descriptors, catalog files, resolvers, schemas, fixtures, and pack workflows begin only after that gate is merged, verified, and tagged.

The repository license is not selected yet. No third-party source or template content may be imported until its license and redistribution obligations are reviewed.
