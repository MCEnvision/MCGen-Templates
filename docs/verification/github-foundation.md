# GitHub Governance and Foundation Verification

## Scope

This record verifies Phase 1 of the [GitHub completion plan](../general/github_plan.md). It covers repository identity, signed Git history, branch and merge controls, baseline collaboration files, Actions permissions, native security, dependencies, environments, immutable releases, cost guardrails, planning surfaces, and completion evidence.

The controls were implemented through [foundation pull request 6](https://github.com/MCEnvision/MCGen-Templates/pull/6). The complete Phase 1 audit was repeated on August 9, 2026 before the GitHub completion plan entered its integration pull request.

## Audit Result

Every required Phase 1 control is configured and verified. No unresolved authentication, signing, billing, collaborator, ruleset, workflow, environment, dependency, or native security blocker remains.

The repository license remains an explicit owner decision. No template pack release exists yet, so release artifact attestations, checksums, SBOM publication, and release validation remain correctly inactive until a real deterministic pack artifact exists.

## Repository Identity and Authorization

1. The repository is the public `MCEnvision/MCGen-Templates` repository.
2. The canonical default branch is `main`.
3. The active GitHub identity is `EnVisione` with repository and Project access sufficient for the configured governance operations.
4. `origin` resolves to the intended repository.
5. Issues, Projects, and the wiki are enabled. Discussions remain disabled because no maintained discussion workflow exists yet.
6. `EnVisione` is the administrative maintainer. The existing organization member collaborator has read access only. No outside collaborator, paid seat, or expanded write authority was added.

## Git Identity and Signing

1. Every locally created repository commit uses `EnVy` with `contact.enviouse@gmail.com` as both author and committer. Every annotated tag uses that identity as tagger.
2. Locally created repository commits and annotated tags use SSH signing key fingerprint `SHA256:5jmRCFzo+bZaW2BhCjheIiFmhSXZTs+m3gah/SANlhI`.
3. Local signing is mandatory for repository commits and annotated tags.
4. GitHub generated pull request merge commits are platform authored objects. GitHub is necessarily their committer and must provide valid GitHub signature verification.
5. Future GraphQL merges explicitly set `authorEmail` to `contact.enviouse@gmail.com`. The merge author remains `EnVy`.
6. Pull request 14 predates that explicit merge input. Its verified GitHub merge commit uses `EnVy` with an approved EnVisione account email and GitHub as the signed committer. Protected published history is not rewritten solely to change merge metadata.
7. GitHub reports the foundation merge commit and signed annotated foundation tag as verified.
8. The signed annotated tag `phase-0-github-foundation` points to merge commit `c044312f3a0786057c629122054f2451996dd78c`.
9. API authorization and cryptographic signing remain separate gates. The current token intentionally lacks SSH signing key administration scope. Remote verification of pushed signed objects proves the configured key is registered without broadening token authority.

## Main Branch Ruleset

The active ruleset is `protect main`, ruleset identifier `20615245`. It targets the default branch and has no bypass actors.

1. Direct updates require a pull request.
2. Branch deletion is blocked.
3. Non fast forward updates and force pushes are blocked.
4. Review conversations must be resolved.
5. Required human approvals remain zero.
6. Merge commits are the only enabled pull request integration method.
7. Required checks use strict branch synchronization.
8. The exact required checks are `quality / documentation`, `quality / secret scan`, and `quality / node`.
9. Each required check name was observed successfully before it entered the ruleset.
10. Historical phase branches are preserved because automatic branch deletion is disabled.

The successful merge of [foundation pull request 6](https://github.com/MCEnvision/MCGen-Templates/pull/6) proves the normal pull request path works. The ruleset configuration proves direct updates, deletion, and force pushes are rejected without relying on a destructive test.

## Merge and Workflow Permissions

1. Merge commits and auto merge are enabled.
2. Squash and rebase merging are disabled.
3. The default workflow token is read only.
4. Workflow tokens cannot approve pull requests.
5. Actions use the selected policy.
6. GitHub owned actions and verified creators are allowed.
7. The pinned central `MCEnvision/.github` reusable workflows and approved credential scanner are allowed.
8. Full commit SHA pinning is required.
9. Repository workflow files contain no floating Action references.
10. Workflow permissions use least privilege and do not expose secrets to untrusted pull requests.
11. Pull request merges use the GraphQL `authorEmail` input when available so the EnVy merge author uses `contact.enviouse@gmail.com` while GitHub remains the verified platform committer.

## Tracked Collaboration Baseline

The following baseline is present and linked from canonical documentation.

1. Structured defect and feature issue forms.
2. Pull request template.
3. CODEOWNERS.
4. Security policy.
5. Release note categories.
6. Path based pull request labels.
7. Repository specific GitHub instructions.
8. Thin caller workflows for centralized quality checks.
9. Dependabot configuration for GitHub Actions and the root npm ecosystem.
10. Root README, documentation index, technical overview, active plan, GitHub completion plan, contribution guide, architecture, trust model, verification policy, and release policy.

`AGENTS.md` and `.codegraph/` are ignored and untracked. Action references are pinned to full commit identifiers. No credentials, machine local paths, caches, logs, or generated build output are tracked.

## Security and Dependency Controls

1. CodeQL default setup is enabled for the detected GitHub Actions and JavaScript or TypeScript language families.
2. CodeQL runs weekly and on its supported repository events.
3. Native secret scanning and push protection are enabled.
4. Private vulnerability reporting is enabled.
5. The dependency graph, Dependabot alerts, and Dependabot security updates are enabled.
6. Dependabot covers GitHub Actions and the root npm manifest directory on a weekly schedule.
7. Minor and patch dependency proposals are grouped. Major platform and toolchain changes remain visible for explicit review.
8. No unexplained open CodeQL, Dependabot, or secret scanning alert existed at audit time.
9. Historical incompatible major Dependabot proposals are closed and do not represent active security findings.
10. Dependency review runs on pull requests. Its main branch push path is intentionally skipped because no comparison pull request exists there.
11. Gradle dependency submission remains deferred until canonical Gradle or Maven manifests exist in this repository. Generated downstream projects do not make a package ecosystem present here.

## Environments, Releases, and Cost Guardrails

1. The `testing` environment accepts `main` and `envy/phase_*` branches.
2. The `production` environment accepts `main` and `phase-*` tags.
3. Neither environment requires a human reviewer.
4. No release environment or publication credential exists before a real release workflow requires one.
5. Immutable releases are enabled.
6. No release exists yet, which matches the repository implementation state.
7. Organization Actions, Codespaces, Packages, and Git LFS budgets are each set to zero.
8. Each organization budget has `prevent_further_usage` enabled.
9. No paid runner, seat, security product, overage, or metered service was enabled.

## Planning, Issues, and Wiki

1. [Foundation issue 5](https://github.com/MCEnvision/MCGen-Templates/issues/5) records the scope, acceptance criteria, identity reconciliation, and completion evidence. Its state must match the latest Phase 1 integration state, and it remains the deduplicated tracker for this governance work.
2. [Foundation pull request 6](https://github.com/MCEnvision/MCGen-Templates/pull/6) is merged through GitHub with the `phase 0. repository foundation` milestone.
3. The [MCGen Templates roadmap](https://github.com/orgs/MCEnvision/projects/9) is linked to the repository and contains lifecycle fields, roadmap views, and status workflows.
4. Repository milestones represent phases owned by this repository.
5. The [project wiki](https://github.com/MCEnvision/MCGen-Templates/wiki) links back to canonical tracked documentation, Issues, the roadmap, milestones, releases, security reporting, and support guidance.
6. Tracked documentation remains canonical. Wiki content is published only after the corresponding documentation merges.

## Workflow and Signature Evidence

1. Foundation source branch: `envy/phase_0_github_foundation`.
2. Foundation pull request: [pull request 6](https://github.com/MCEnvision/MCGen-Templates/pull/6).
3. Pull request quality run: [run 31344524145](https://github.com/MCEnvision/MCGen-Templates/actions/runs/31344524145).
4. Main quality run: [run 31344733119](https://github.com/MCEnvision/MCGen-Templates/actions/runs/31344733119).
5. Foundation merge commit: [`c044312f3a0786057c629122054f2451996dd78c`](https://github.com/MCEnvision/MCGen-Templates/commit/c044312f3a0786057c629122054f2451996dd78c).
6. Verified signed foundation tag: [`phase-0-github-foundation`](https://github.com/MCEnvision/MCGen-Templates/tree/phase-0-github-foundation).
7. Phase 1 audit pull request: [pull request 14](https://github.com/MCEnvision/MCGen-Templates/pull/14).
8. Phase 1 audit merge commit: [`a917585249198fad6df859e45add83844a15d906`](https://github.com/MCEnvision/MCGen-Templates/commit/a917585249198fad6df859e45add83844a15d906).
9. Verified signed Phase 1 audit tag: [`phase-1-github-governance`](https://github.com/MCEnvision/MCGen-Templates/tree/phase-1-github-governance).
10. Phase 1 identity reconciliation tag: `phase-1-github-governance-reconciliation`. This tag must point to the GitHub merge commit containing the identity correction.

## Local Verification

Run documentation verification from a clean worktree containing only the proposed tracked changes.

```bash
npm ci
npm run verify
git diff --check origin/main...HEAD
git ls-files
git log --show-signature -1
```

Review Markdown links and fence pairs, inspect the complete tracked diff, and confirm no secret, local path, cache, log, or unrelated generated file entered the commit.

## Continuing Drift Audit

Every later phase must recheck repository identity, authentication, signing, rulesets, stable required checks, Actions pins and permissions, security alerts, Dependabot coverage, environment restrictions, immutable releases, zero cost guardrails, active planning state, wiki drift, and the current plan phase. A later phase must repair or explicitly block on material drift before integration.
