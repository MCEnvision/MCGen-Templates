# GitHub Planning and Documentation Control Verification

## Scope

This record covers Phase 2 of the [GitHub completion plan](../general/github_plan.md). It verifies the relationship between the seven GitHub completion phases, the product milestones in the [complete project plan](../general/plan.md), repository issues, the `MCGen-Templates roadmap` Project, pull requests, tracked documentation, and the wiki.

Phase 2 changes planning and collaboration controls only. It does not implement source adapters, catalog generation, profiles, templates, fixtures, tuple builds, releases, the generator application, the GitHub App, Nginx, or Cloudflare deployment.

## Planning Layers

The repository uses two related phase systems:

1. Product phases in `docs/general/plan.md` describe implementation scope and ownership across `MCGen-Templates` and the future `MCGen` application repository.
2. GitHub completion phases in `docs/general/github_plan.md` describe the sequential repository integration, governance, evidence, and completion gates.

The systems are intentionally not one to one. `MCGen-Templates` keeps five product milestones because those are the implementation milestones owned by this repository. The GitHub plan maps its seven completion phases to those milestones instead of creating duplicate milestone names.

## Canonical Ownership

Tracked documentation is canonical. The wiki provides navigation and operator guidance after the related tracked changes merge.

| Subject                                                       | Canonical owner                             |
| ------------------------------------------------------------- | ------------------------------------------- |
| Complete product requirements and product phases              | `docs/general/plan.md`                      |
| Seven repository completion phases and GitHub operating gates | `docs/general/github_plan.md`               |
| Current repository architecture and commands                  | `docs/general/documentation.md`             |
| Documentation navigation                                      | `docs/README.md`                            |
| Repository contribution workflow                              | `docs/general/contributing.md`              |
| Issue state, dependencies, milestones, and Project fields     | GitHub Issues and `MCGen-Templates roadmap` |
| Curated navigation after merge                                | GitHub wiki                                 |

Website, public API, user facing CLI, generator core, GitHub App, destination repository writes, Nginx, Cloudflare, and production deployment belong to the future `MCEnvision/MCGen` repository. They remain in the complete product plan for sequencing, but they must not be represented as active implementation issues or milestones in this template repository.

## Tracking Evidence

Phase 2 is tracked by [issue 16](https://github.com/MCEnvision/MCGen-Templates/issues/16) in the linked [MCGen-Templates roadmap](https://github.com/orgs/MCEnvision/projects/9). Issue `1` remains the repository implementation parent. The [template repository work item table](../general/plan.md#1121-template-repository-work-items) links the nine dependent implementation issues from issue `17` through issue `25`.

## Roadmap Project Contract

The linked Project is `MCGen-Templates roadmap`.

Required planning data includes:

1. Status with backlog, ready, in progress, in review, blocked, and done states.
2. Phase using the repository owned product milestone family.
3. Priority using the organization issue field.
4. Type using the native issue type.
5. Target version for the applicable GitHub phase, pack version, or release target.
6. Effort using the organization issue field.
7. Risk with low, medium, high, and critical states.

Useful views are Current phase, Roadmap, Board, Bugs, and Releases. Native workflows should add repository issues and pull requests, initialize lifecycle state, move reopened work out of done, move closed issues and merged pull requests to done, and archive completed items only under an explicit retention policy.

Project workflow creation and view field visibility may require the GitHub Project interface because the public command line and GraphQL surfaces do not expose every workflow authoring operation. All issue, milestone, field value, subissue, dependency, and lifecycle changes should use the authenticated command line or API when those surfaces support the exact operation.

The Phase 2 configuration audit records eight enabled workflows:

1. Automatically add open issues and pull requests matching `is:issue,pr is:open`.
2. Automatically add subissues.
3. Initialize an item when it is added to the Project.
4. Update an item when its linked issue closes.
5. Update an item when its linked pull request merges.
6. Update an item when a pull request is linked to an issue.
7. Close the linked issue under the configured completion condition.
8. Move reopened items to ready.

Automatic archival remains disabled because no retention period has been selected. This is a fail safe policy, not an omitted completion claim. Phase 2 may enable archival only after the owner chooses and documents the retention period. The native Type field is visible in the Project views. GraphQL Project field enumeration may omit native issue fields, so absence from that response alone is not evidence that Type, Priority, or Effort is missing.

## Issue Contract

Issue `1` remains the parent implementation issue while its acceptance criteria are active. Independently actionable repository work should use deduplicated subissues for:

1. Source adapters.
2. Catalog generation.
3. Toolchain profiles.
4. Template families.
5. Customization contracts.
6. Fixture generation.
7. Exact tuple verification.
8. Release publication.
9. Maintenance automation.

Each issue needs repository ownership, measurable acceptance criteria, the correct milestone, Project fields, dependencies, and links to satisfying pull requests. An item becomes done only after its acceptance criteria pass and the satisfying pull request is merged. Exploitable security findings use private vulnerability reporting instead of public issues.

Issue and pull request numbers share one repository sequence. The complete product plan therefore uses logical work item names and adds actual issue links only after creation. It does not reserve fictional issue numbers.

## Pull Request Evidence Contract

Each phase pull request records:

1. Scope and explicit non goals.
2. Parent issue, subissues, dependencies, milestone, and roadmap state.
3. Compatibility, migration, documentation, and release effects.
4. Exact local and GitHub verification results.
5. Independent review result or an accurate unavailable status.
6. Risks, failure behavior, rollback, and recovery.
7. Secret, generated output, machine local path, cache, log, and unrelated file audit.

The linked issue and Project item remain in review while the pull request is open. They move to done only after merge and post merge verification.

## Verification Procedure

Before Phase 2 integration:

1. Compare the seven GitHub phases with the five repository owned product milestones.
2. Confirm every open repository issue has the correct native type, milestone, Project membership, status, phase, priority, effort, risk, and target version.
3. Confirm subissue and dependency relationships match the documented order.
4. Confirm merged work is done and closed unmerged work is not represented as completed implementation.
5. Confirm open pull requests and active branches are linked to tracked work.
6. Validate issue forms and the pull request template.
7. Validate Markdown fence pairs, repository relative links, and documentation navigation.
8. Run the full locked repository verification gate and `git diff --check`.
9. Inspect the complete diff and tracked file list for secrets, generated output, machine local paths, caches, logs, and unrelated changes.

After merge:

1. Confirm required checks pass on the merged `main` commit.
2. Confirm issue, pull request, milestone, and Project lifecycle state matches the merge result.
3. Publish the wiki navigation update from the merged tracked documentation.
4. Create the verified signed annotated tag `phase-2-github-planning` on the approved `main` commit.
5. Confirm the tag resolves to that commit and preserves the required EnVy signing identity.

## Completion Gate

Phase 2 is complete only when no active repository task exists solely in chat or an unlinked branch, no stale planning or wiki state remains, every later GitHub phase has explicit work and evidence gates, required checks pass on `main`, and `phase-2-github-planning` identifies the merged Phase 2 commit.

Until those post merge conditions pass, this record describes the Phase 2 contract and verification procedure rather than a completion claim.
