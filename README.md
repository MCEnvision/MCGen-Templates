# MCGen Templates

MCGen Templates is the canonical public source for verified Minecraft project templates used by MCGen.

The repository is currently in its planning and bootstrap stage. No template branches or machine readable registry have been published yet.

## Repository Model

The `main` branch is the lightweight control branch. Its initial commit contains only this README and the [active project plan](docs/general/plan.md).

Version-bound template branches will use the format `<platform>/<minecraft-version>`, such as `neoforge/1.21.1` or `fabric/1.21.1`. API-bound proxy and plugin families use their real API compatibility line instead of inventing a Minecraft patch mapping.

The target is complete official coverage. Each branch represents one compatibility boundary and exposes every exact compatible loader, API, mappings, build-plugin, wrapper, and language-adapter version through the central catalog. Exact loader builds do not create thousands of duplicate branches. MCGen will pin the selected branch, template commit, profile, catalog snapshot, and exact component tuple before generation.

## Current Status

Architecture and implementation work are defined in the active plan. Templates, registry files, workflows, contribution policies, and supporting documentation will be introduced through approved phase branches and pull requests.
