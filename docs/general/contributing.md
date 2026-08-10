# Contributing to MCGen Templates

## Current Stage

The repository is in Phase 0. Contributions currently focus on repository foundations, template-pack contracts, authoritative source research, schemas, profiles, fixtures, and verification design. Do not add a ready-made project for one Minecraft version or create a platform/version branch.

Search existing issues and read the [active plan](plan.md) before starting work. Planned behavior must be linked to the correct phase and milestone before implementation.

## Branch and Pull Request Workflow

1. Start from the latest approved `origin/main`.
2. Use a focused branch under `envy/` for maintainer phase work or a descriptive contributor branch in a fork.
3. Keep changes within one approved phase or independently reviewable issue.
4. Update documentation and verification with the behavior or contract being changed.
5. Run every applicable local check.
6. Open a pull request using the repository template.
7. Resolve review conversations and required checks.
8. Merge through GitHub using the merge-commit method.

Do not force-push shared phase branches, rewrite published history, bypass checks, or push directly to `main`.

## Template Family Contributions

A platform or compatibility contribution must identify whether it changes:

- Catalog data only.
- A toolchain profile.
- A conditional boundary fragment.
- A reusable template family.
- A descriptor or serialized schema.
- Verification evidence.

A new exact loader or API build normally belongs in catalog data. Create or change a template family only when generated structure or behavior changes.

Every family contribution must include:

- Authoritative platform documentation or metadata evidence.
- License and redistribution review for imported starter or MDK content.
- Typed descriptor fields and validation.
- Conditional files and field-to-file mappings.
- Supported profiles and exact compatibility constraints.
- Minimal and maximum-customization fixtures.
- Deterministic output expectations.
- Exact build and artifact-inspection procedures.
- Coverage-report behavior for unsupported or blocked tuples.

Do not copy Minecraft Development plugin source or bundled templates into this repository. They are architectural references and carry separate LGPL obligations.

## Documentation Changes

Update the relevant files when a change affects architecture, schemas, security, verification, contribution rules, release behavior, compatibility, or repository operation. Keep [the documentation index](../README.md) synchronized when files are added, moved, or removed.

Documentation must distinguish planned behavior from implemented behavior. Examples must use placeholders when an exact version is not backed by committed evidence.

## Current Verification

Until implementation manifests exist, run:

```bash
git diff --check
git status --short
git ls-files
```

Also verify Markdown fence pairing, links, paths, secrets, machine-local files, and the complete diff. GitHub quality checks provide documentation and credential validation.

Future implementation phases will add repository-specific schema, unit, property, snapshot, generation, build, artifact, and coverage commands.

## Security

Never commit credentials, tokens, private keys, environment files, private infrastructure details, logs containing secrets, or unrelated private source. Report exploitable vulnerabilities through GitHub private vulnerability reporting as described in the [security policy](../../.github/SECURITY.md).

The production service will not execute contributor-provided generated build logic. Canonical fixture builds run only after repository review and within the declared verification policy.
