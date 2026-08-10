# Repository Completion Audit

The repository completion audit is a twenty requirement contract. It checks GitHub governance, synchronized planning, authoritative source coverage, catalog completeness, profiles, templates, customization, tuple verification, release evidence, maintenance automation, security, and ownership boundaries.

Each requirement is reported independently as `passed`, `blocked`, or `failed`, with evidence paths and a remediation detail. The aggregate audit remains blocked while any required profile, template, tuple, GitHub, security, release, or documentation evidence is missing. A published beta release does not by itself pass the audit.

The audit is deterministic when its input and generated timestamp are fixed. It must run from a clean checkout, use the current merged main evidence, and never treat an unmerged branch or an unverified catalog component as complete. The final phase 7 gate requires all twenty requirements to pass and the result to be reconciled to issue 25, the roadmap, the plan, and the wiki.

## Evidence rules

Local evidence is content checked, not an existence check. The audit reads the indexed profile and descriptor documents and verifies their ids, schema versions, statuses, and explicit blockers. A loader, plugin, proxy, or multiloader capability remains blocked until every profile and descriptor in that capability is reviewed. Blocked records are acceptable repository evidence only when their blocker reason and evidence paths are present.

Catalog coverage reads each referenced platform index and catalog shard. Every component mapping must contain an id, component, coordinate, version, status, and source entry binding. Profile selectors are checked against the actual catalog index, and explicit selectors must resolve to an actual coordinate. A directory containing files with malformed or unrelated JSON cannot satisfy this requirement.

The tuple requirement reads the phase 5 audit, matrix, coverage, and evidence records. Every verified matrix tuple must have an evidence record whose digest exactly matches the tuple id and whose build, artifact, and reproducibility states are verified. Every discovered or blocked tuple must carry an explicit blocker mapping. The phase 5 audit summary alone is not sufficient because it can report verified representative evidence while other matrix tuples remain discovered.

Customization and asset requirements inspect every indexed descriptor for Simple and Advanced fields, raw operations, editable version fields, and PNG icon slots. Source adapter checks inspect every registered definition and retained snapshot directory. Maintenance, recovery, hygiene, documentation, and ownership checks read the expected contract text and validate required markers. A passing capability therefore records both the file digest and the semantic contract that was observed.
