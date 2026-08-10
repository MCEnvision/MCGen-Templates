# MCGen Templates Documentation

## Start Here

- [Technical overview](general/documentation.md)
- [Active plan](general/plan.md)
- [GitHub completion plan](general/github_plan.md)
- [Contribution guide](general/contributing.md)
- [Template pack architecture](architecture/template-pack.md)
- [Template families](architecture/template-families.md)
- [Source snapshots](data/source-snapshots.md)
- [Compatibility catalog](data/compatibility-catalog.md)
- [Toolchain profiles](data/toolchain-profiles.md)
- [Project specification and customization](data/project-spec.md)
- [Trust model](security/trust-model.md)
- [GitHub foundation verification](verification/github-foundation.md)
- [GitHub planning verification](verification/github-planning.md)
- [Template pack contract verification](verification/template-pack-contracts.md)
- [Phase 4 contract verification](verification/phase4-contracts.md)
- [Phase 5 build and artifact contracts](verification/phase5-build-contracts.md)
- [Phase 6 release verification](verification/phase6-release.md)
- [Template pack releases](release/template-pack-releases.md)
- [Pack construction](release/pack-construction.md)
- [Project wiki](https://github.com/MCEnvision/MCGen-Templates/wiki)
- [Issues](https://github.com/MCEnvision/MCGen-Templates/issues)
- [Roadmap](https://github.com/orgs/MCEnvision/projects/9)

## Organization

Documentation is organized by the subjects that currently exist. Add a category only when the repository has real behavior or contracts to document there.

- `general/` contains the project overview, active plan, and contribution workflow.
- `architecture/` contains the descriptor, catalog, profile, rendering, and adapter boundaries.
- `data/` contains source snapshot formats, provenance, exact capture evidence, and reconciliation rules.
- `security/` contains trust boundaries, input handling, execution limits, integrity, and licensing controls.
- `verification/` contains repository governance, planning, contract, source, and future compatibility verification gates.
- `release/` contains the immutable template pack release contract.

The tracked documentation is canonical. The wiki is a navigation and operator surface and must link back to these files.
