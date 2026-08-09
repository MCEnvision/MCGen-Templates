# MCGen Templates

MCGen Templates is the canonical public source for verified Minecraft project templates used by MCGen.

The repository is currently in its planning and bootstrap stage. No template branches or machine readable registry have been published yet.

## Repository Model

The `main` branch is the lightweight control branch. Its initial commit contains only this README and the [active project plan](docs/general/plan.md).

Future template branches will use the format `<platform>/<minecraft-version>`, such as `neoforge/1.21.1` or `fabric/1.21.1`. MCGen will resolve templates through a registry on `main`, pin every retrieval to an immutable commit, and verify the content digest before generation.

## Current Status

Architecture and implementation work are defined in the active plan. Templates, registry files, workflows, contribution policies, and supporting documentation will be introduced through approved phase branches and pull requests.
