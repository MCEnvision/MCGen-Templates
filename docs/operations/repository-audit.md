# Repository Completion Audit

The repository completion audit is a twenty requirement contract. It checks GitHub governance, synchronized planning, authoritative source coverage, catalog completeness, profiles, templates, customization, tuple verification, release evidence, maintenance automation, security, and ownership boundaries.

Each requirement is reported independently as `passed`, `blocked`, or `failed`, with evidence paths and a remediation detail. The aggregate audit remains blocked while any required profile, template, tuple, GitHub, security, release, or documentation evidence is missing. A published beta release does not by itself pass the audit.

The audit is deterministic when its input and generated timestamp are fixed. It must run from a clean checkout, use the current merged main evidence, and never treat an unmerged branch or an unverified catalog component as complete. The final phase 7 gate requires all twenty requirements to pass and the result to be reconciled to issue 25, the roadmap, the plan, and the wiki.
