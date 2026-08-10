# Security Policy

## Reporting a Vulnerability

Use [GitHub private vulnerability reporting](https://github.com/MCEnvision/MCGen-Templates/security/advisories/new). Do not open a public issue for an exploitable vulnerability, leaked credential, private infrastructure detail, or security-sensitive reproduction.

For ordinary defects that are not security sensitive, use the structured bug report form.

Include the affected source commit or pack version, impact, prerequisites, reproduction steps, and sanitized evidence. Do not include live credentials or unrelated private data. Maintainers will confirm receipt in the private advisory and coordinate validation, remediation, disclosure, and release timing there.

## Supported Versions

Security fixes target the latest supported release unless the repository documentation states otherwise. Check the root README and release notes for the current support policy.

The repository does not publish a template pack yet. Until the first release, report findings against the affected source commit.

## Security Boundaries

Descriptors and project specifications are data and must not execute code. The public service may validate, render, preview, and package input, but it must not run generated build logic or contributor supplied code. See the [template pack trust model](../docs/security/trust-model.md) for the complete boundary.
