# MCGen Templates

MCGen Templates is the canonical public source for the versioned template pack and compatibility catalog used by MCGen.

The GitHub governance phase is complete. GitHub completion Phase 2 defines planning and documentation control, and its verified signed tag records when that gate is complete. GitHub completion Phase 3 is active on authoritative source coverage. The Phase 3 branch provides versioned template-pack contracts, locked Node.js validation tooling, fourteen authoritative source adapters, immutable snapshots, and a deterministic source-backed compatibility catalog. No template family, toolchain profile, generated project, or pack release has been published yet.

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

The current implementation layout is:

```text
schemas/      Versioned descriptor, source, catalog, profile, coverage, and pack contracts.
sources/      Authoritative source definitions and immutable normalized snapshots.
src/          Deterministic validation, digest, fetch, and source-adapter tooling.
tests/        Unit, parser, schema, and repository-document verification.
docs/         Architecture, data, security, contribution, verification, and release guidance.
```

`catalog/` contains immutable discovered-source evidence. `templates/`, toolchain profile instances, and generated verification fixtures will be added only when their reviewed families and exact evidence exist.

## Development

Install the locked Node.js 22 toolchain and run the full verification gate:

```bash
npm ci
npm run verify
```

Validate canonical repository JSON independently with `npm run validate`. Capture a new immutable Forge snapshot with an explicit unused path:

```bash
npm run snapshot:forge -- --output sources/snapshots/forge/YYYY-MM-DD.json
```

The snapshot writer refuses to overwrite an existing file.

Generate a content-addressed catalog from immutable snapshots with an unused output directory:

```bash
npm run build --silent
node dist/cli.js catalog generate --output catalog/YYYY-MM-DD
```

## Documentation

The [complete project plan](docs/general/plan.md) defines product phases and implementation ownership. The [GitHub completion plan](docs/general/github_plan.md) defines seven sequential repository integration and evidence phases. These phase systems are related but are not interchangeable.

- [Documentation index](docs/README.md)
- [Technical overview](docs/general/documentation.md)
- [Active plan](docs/general/plan.md)
- [GitHub completion plan](docs/general/github_plan.md)
- [Contribution guide](docs/general/contributing.md)
- [Source snapshots](docs/data/source-snapshots.md)
- [Compatibility catalog](docs/data/compatibility-catalog.md)
- [Template pack contract verification](docs/verification/template-pack-contracts.md)
- [GitHub governance verification](docs/verification/github-foundation.md)
- [GitHub planning verification](docs/verification/github-planning.md)
- [Security policy](.github/SECURITY.md)
- [Issue tracker](https://github.com/MCEnvision/MCGen-Templates/issues)
- [Wiki](https://github.com/MCEnvision/MCGen-Templates/wiki)

## Current Status

The current Phase 3 evidence set contains twenty nine immutable source snapshots, including fifteen retained historical captures and fourteen current captures. The current content addressed catalog has 2,540 shards. Every accepted current source entry is represented in a catalog shard, and all eighty six rejected upstream values have exact structured coverage blockers. No catalog component is a verified generated project tuple.

The repository license is not selected yet. No third-party source or template content may be imported until its license and redistribution obligations are reviewed. Snapshot discovery does not claim that any generated Forge project or exact tuple is verified.
