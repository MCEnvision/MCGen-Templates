# GitHub Foundation Verification

## Scope

This checklist verifies the repository collaboration, security, planning, and release foundation before product implementation begins.

## Local Baseline

- `AGENTS.md` is ignored and untracked.
- `.codegraph/` is ignored and untracked.
- README, documentation index, technical overview, active plan, contribution guide, security policy, architecture, trust model, verification, and release documents are linked.
- Pull-request template, structured issue forms, CODEOWNERS, release-note categories, labeler configuration, Copilot instructions, Dependabot, and thin quality caller exist.
- GitHub Actions references use full commit SHAs.
- Dependabot covers every detected ecosystem and directory.
- `git diff --check` passes.
- Markdown fences are paired.
- No credentials, machine-local paths, caches, logs, or generated output are tracked.

## Remote Baseline

- Repository ownership, public visibility, default branch, and active EnVisione identity are verified.
- Merge commits and auto merge are enabled.
- Squash and rebase merges are disabled.
- Automatic phase-branch deletion is disabled.
- Default workflow token permissions are read only.
- Workflow pull-request approval is disabled.
- Actions require SHA-pinned references.
- Default-branch rules block direct updates, deletion, and force pushes.
- Pull requests and resolved conversations are required with zero mandatory approvals.
- Exact stable quality checks are required only after successful observation.
- `testing` and `production` environments exist without required reviewers.
- Secret scanning and push protection are enabled.
- Dependency graph, Dependabot alerts, and security updates are enabled.
- Private vulnerability reporting is enabled.
- Immutable releases are enabled.
- Topics and labels reflect repository scope.
- Repository-owned milestones match the active plan.
- Wiki Home links to canonical documentation and planning.
- Organization Actions, Codespaces, Packages, and Git LFS budgets are zero with further usage blocked.

## Workflow Evidence

Record the pull request, source commit, quality run URLs, observed check names, merge commit, and signed phase tag before closing the foundation issue. Do not mark this checklist complete from file presence alone.

## Remaining Owner Decisions

Repository licensing remains an explicit owner choice. Project scope was approved, and [the repository roadmap](https://github.com/orgs/MCEnvision/projects/9) is configured and synchronized.
