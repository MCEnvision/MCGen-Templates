# MCGen — Complete Project Plan

> **Working name:** MCGen
> **Purpose:** An open-source, IDE-independent Minecraft project generator and GitHub provisioning platform for mods, plugins, and proxies across legacy and modern Minecraft versions.

---

## 1. Executive Summary

MCGen will provide a single, intuitive way to create Minecraft development projects without requiring IntelliJ IDEA or the Minecraft Development plugin.

The system will support three primary interfaces:

1. **Web application** hosted at `https://mcgen.enviouse.com` by a custom Nginx origin reached only through Cloudflare Tunnel.
2. **CLI** for local generation and GitHub automation.
3. **Public API / reusable generator library** for third-party tools, IDE integrations, CI workflows, and automation.

The core experience should allow a developer to:

- Select a project type:
  - Mod
  - Plugin
  - Proxy
- Select a platform:
  - Bukkit
  - Spigot
  - Paper
  - Sponge
  - Forge
  - NeoForge
  - Fabric
  - Architectury
  - Velocity
  - BungeeCord
- Select a Minecraft version.
- Select Java or Kotlin when supported.
- Configure project metadata.
- Enable supported optional features such as Mixins or Parchment.
- Generate a completely minimal development project.
- Download the result as a ZIP.
- Create a brand-new GitHub repository.
- Add a generated project to an existing GitHub repository.
- Create a new version/port branch from an existing branch.
- Open a Pull Request instead of directly modifying a branch.
- Perform the same tasks from a CLI.
- Perform the same tasks through an API.

The canonical templates will live in the public `MCEnvision/MCGen-Templates` GitHub repository. Each platform and Minecraft-version combination uses its own Git branch.

Example:

```text
main

bukkit/1.21.1
paper/1.21.1
spigot/1.21.1

forge/1.8.9
forge/1.12.2
forge/1.20.1

fabric/1.21.1
fabric/26.1

neoforge/1.21.1
neoforge/26.1

velocity/3.x
bungeecord/1.21.1
```

The `main` branch should remain intentionally simple and primarily contain project documentation and repository metadata.

---

# 2. Product Vision

MCGen should become the Minecraft development equivalent of a project scaffolding platform such as:

- `create-next-app`
- `cargo new`
- `npm create`
- Spring Initializr

but focused on Minecraft development.

The product should feel like:

> **Minecraft Development project creation without requiring IntelliJ, with GitHub-native automation and support for legacy Minecraft development.**

The most important design principles are:

- Minimal
- Predictable
- Version-aware
- IDE-independent
- GitHub-native
- Scriptable
- Open-source
- Safe for existing repositories
- Easy for beginners
- Powerful for advanced developers

---

# 3. Core Goals

## 3.1 Primary Goals

MCGen must:

- Generate valid development environments.
- Support multiple Minecraft loaders/platforms.
- Support legacy Minecraft versions wherever practical.
- Support modern Minecraft versions.
- Keep generated projects minimal.
- Use the correct Java version for the selected Minecraft/toolchain.
- Use the correct Gradle/toolchain versions.
- Allow complete customization of project identity, metadata, artifact version, build properties, dependencies, repositories, source layout, generated resources, publishing configuration, and loader-specific settings.
- Allow a user-supplied PNG project icon or logo with preview, validation, transformation options, and correct loader-specific metadata wiring.
- Provide Simple and Advanced modes. Advanced mode includes complete structured customization and a raw file workspace, so advanced users are never forced to accept generated defaults.
- Preserve one canonical typed project specification across the website, CLI, API, GitHub integration, and reusable library.
- Support automatic GitHub repository creation.
- Support creating branches inside existing repositories.
- Support porting an existing branch to a new Minecraft version.
- Support generating projects locally through a CLI.
- Expose generator functionality through an API/library.
- Continuously verify templates through CI.

---

## 3.2 Secondary Goals

MCGen should eventually support:

- Modrinth publishing configuration.
- CurseForge publishing configuration.
- GitHub Releases.
- Semantic versioning/release automation.
- IDE integration.
- VS Code extension.
- JetBrains plugin.
- GitHub Action.
- Docker/Dev Container support.
- Nix/CachyOS/Arch-friendly development setup.
- Workspace/multi-loader projects.
- Multi-version projects.
- Automated migration assistance.

---

# 4. Non-Goals for Initial Release

The first stable version should **not** attempt to:

- Automatically rewrite Minecraft gameplay code between versions.
- Automatically fix mappings/API breakage.
- Automatically convert Forge code to Fabric code.
- Replace build tools such as Gradle.
- Become an IDE.
- Provide a full Minecraft modding tutorial.
- Host user source code.
- Store GitHub access tokens permanently unless required by the selected authentication architecture.
- Execute arbitrary user-edited Gradle scripts, plugins, repositories, or generated source code on the public MCGen production server.

MCGen may generate and export arbitrary text-based project customizations, including complete Gradle file overrides. These files become the user's responsibility. Only trusted canonical templates may run in ordinary MCGen CI. Untrusted customized builds require a purpose-built isolated sandbox before any future hosted build feature can execute them.

The generator provides the **correct development environment and project structure**.

It does not guarantee that an existing mod's source code will compile after changing Minecraft versions.

---

# 5. Supported Project Categories

## 5.1 Mods

Initial targets:

- Forge
- NeoForge
- Fabric
- Architectury
- Configurable multiloaders with shared common code and selected Forge, NeoForge, and Fabric targets

Future possibilities:

- Quilt
- Legacy Fabric
- specialized modding ecosystems if demand exists

---

## 5.2 Plugins

Initial targets:

- Bukkit
- Spigot
- Paper
- Sponge

---

## 5.3 Proxies

Initial targets:

- Velocity
- BungeeCord

---

# 6. Version Support Philosophy

Each platform should support:

> **The earliest version that can be reasonably maintained through the latest stable supported version.**

Example:

```text
Forge
  earliest practical Forge version
  ...
  1.8.9
  1.12.2
  1.16.5
  1.18.2
  1.19.2
  1.20.1
  latest Forge-supported release

NeoForge
  earliest NeoForge-supported release
  ...
  latest NeoForge release

Fabric
  earliest practical Fabric release
  ...
  latest Fabric release
```

Not every individual Minecraft patch version must exist immediately.

Priority should be given to historically important development versions.

Example priority list:

```text
1.8.9
1.12.2
1.16.5
1.18.2
1.19.2
1.19.4
1.20.1
1.20.4
1.20.6
1.21
1.21.1
later 1.21.x
26.x
```

The platform/version registry will determine exactly which combinations are offered.

---

# 7. Git Repository Architecture

## 7.1 Canonical Template Repository

The approved canonical repository is:

```text
https://github.com/MCEnvision/MCGen-Templates
```

It is public so users, the website, the CLI, CI, and external tools can inspect and retrieve verified templates without private credentials. This repository is the only first-party source of canonical template content. Loader APIs and Maven repositories provide compatibility metadata, not template files.

---

## 7.2 `main` Branch

The `main` branch remains the lightweight control branch. Its initial bootstrap commit contains exactly:

```text
README.md
docs/general/plan.md
```

No template, registry, workflow, generated output, or implementation file belongs in the bootstrap commit. Later approved phases may add the registry, contribution policy, security policy, validation workflows, and supporting documentation through phase branches and pull requests.

The `main` branch must never contain one active development template. Template content belongs only in versioned template branches or immutable snapshots derived from them.

---

## 7.3 Template Branches

Branch format:

```text
<platform>/<minecraft-version>
```

Examples:

```text
forge/1.8.9
forge/1.12.2
forge/1.20.1

neoforge/1.21.1
neoforge/26.1

fabric/1.20.1
fabric/1.21.1

paper/1.21.1
velocity/3.4
```

Lowercase platform names are preferred.

---

# 8. Template Rules

Every template branch should be:

- Minimal.
- Buildable.
- Tested.
- Properly version-pinned.
- Easy to customize.
- Free of unnecessary example content.

Templates should avoid shipping:

- Example blocks.
- Example items.
- Example ores.
- Tutorial entities.
- Random demonstration classes.
- Large amounts of placeholder logic.

The template should contain **only what is necessary to launch/build the project**.

Minimal describes the recommended default output, not a limitation on customization. Users may deliberately add examples, source sets, metadata, build logic, dependencies, publishing, assets, and raw files through the generator.

---

# 9. Template Placeholder System

Templates may contain normalized placeholders for simple scalar substitution.

Recommended format:

```text
{{PROJECT_NAME}}
{{PROJECT_ID}}
{{MOD_ID}}
{{PLUGIN_NAME}}
{{PACKAGE}}
{{PACKAGE_PATH}}
{{MAIN_CLASS}}
{{DESCRIPTION}}
{{AUTHORS}}
{{WEBSITE}}
{{LICENSE}}
{{MINECRAFT_VERSION}}
{{PLATFORM_VERSION}}
{{JAVA_VERSION}}
{{GROUP_ID}}
{{ARTIFACT_ID}}
{{PROJECT_VERSION}}
{{ARCHIVES_BASE_NAME}}
{{MOD_ICON_PATH}}
```

Feature-specific placeholders may include:

```text
{{MIXIN_CONFIG}}
{{PARCHMENT_VERSION}}
{{PLUGIN_LOAD_TIME}}
{{API_VERSION}}
```

The placeholder engine is only one rendering mechanism. It must not be the architecture for total customization.

Use the correct renderer for each file type:

```text
JSON metadata
  parse into a typed model, merge validated values, and serialize deterministically

TOML metadata
  parse into a typed model while preserving required tables, arrays, and version-specific fields

YAML metadata
  parse structured commands, permissions, dependencies, and platform fields

Gradle Groovy and Kotlin DSL
  render supported blocks from typed build models, with complete raw-file override as an Advanced escape hatch

Java and Kotlin source
  use focused templates and syntax-aware identifier validation

Binary assets
  insert validated bytes without text substitution
```

Every generated value must have one canonical owner in the project specification. For example, `project.version` should feed Gradle, loader metadata, generated README content, publishing metadata, and artifact previews unless the user explicitly unlocks a target-specific override.

The generator must track which files and fields consume each value. The UI should show this impact before generation.

---

# 10. Template Manifest

Every template branch should contain:

```text
.mcgen/template.json
```

Example:

```json
{
  "schemaVersion": 1,
  "platform": "neoforge",
  "minecraftVersion": "1.21.1",
  "type": "mod",
  "javaVersion": 21,
  "languages": ["java", "kotlin"],
  "features": {
    "mixins": true,
    "parchment": true,
    "dataGen": true,
    "githubActions": true,
    "dependabot": true
  },
  "files": {
    "entrypoint": "src/main/java/{{PACKAGE_PATH}}/{{MAIN_CLASS}}.java"
  },
  "configurationSchema": ".mcgen/configuration.schema.json",
  "fieldMappings": ".mcgen/field-mappings.json",
  "assetSlots": {
    "projectIcon": {
      "accept": ["image/png"],
      "defaultPath": "src/main/resources/{{MOD_ID}}.png",
      "metadataField": "mods[0].logoFile"
    }
  },
  "buildCapabilities": {
    "dsl": ["groovy", "kotlin"],
    "customRepositories": true,
    "customDependencies": true,
    "customTasks": true,
    "publishing": true,
    "rawFileOverrides": true
  }
}
```

This manifest allows the generator to understand the template without hardcoding loader-specific logic into the UI. The exact asset path and metadata field vary by platform and version. The example is illustrative, not a universal mapping.

Each template must declare every configurable field with:

```text
stable field ID
label and help text
type
default
required state
validation rules
allowed values or version source
visibility condition
compatibility constraints
render targets
preview behavior
whether a raw override may supersede it
```

Unsupported fields must be absent or visibly unavailable. The UI must never offer a control that the selected template silently ignores.

---

# 11. Central Template Registry

After the registry phase begins, `MCEnvision/MCGen-Templates` should maintain a machine-readable registry on `main`.

Example:

```text
registry/templates.json
```

Concept:

```json
{
  "neoforge": {
    "type": "mod",
    "versions": {
      "1.21.1": {
        "branch": "neoforge/1.21.1",
        "java": 21,
        "status": "verified",
        "templateRevision": 7,
        "configurationSchemaVersion": 1,
        "configurationSchemaDigest": "sha256:<digest>",
        "features": {
          "mixins": true,
          "parchment": true,
          "dataGen": true
        }
      }
    }
  }
}
```

The website, CLI, and API should all consume this registry.

This prevents duplicated compatibility logic.

---

# 12. Template Statuses

Every template should have a status.

Suggested statuses:

```text
verified
legacy-verified
experimental
deprecated
broken
```

Definitions:

### verified

Current template builds successfully and is recommended.

### legacy-verified

Old toolchain but tested and working.

### experimental

Template exists but may contain limitations.

### deprecated

Platform/version is no longer recommended but kept for archival use.

### broken

Known failing template; hidden from normal generator results.

---

# 13. Generator Core

The most important architectural rule:

> **The website must not contain the actual generator logic.**

Create a reusable package:

```text
packages/generator-core
```

Possible package name:

```text
@mcgen/core
```

The generator should accept structured configuration.

Example:

```typescript
generateProject({
  projectType: "mod",
  platform: "neoforge",
  minecraftVersion: "1.21.1",
  language: "java",

  metadata: {
    projectName: "FutureShops",
    projectId: "futureshops",
    packageName: "com.example.futureshops",
    mainClass: "FutureShops",
    description: "Future Shops",
    authors: ["EnVy"],
    website: "",
    license: "MIT"
  },

  build: {
    group: "com.example",
    artifactId: "futureshops",
    version: "1.0.0-beta.1",
    archivesBaseName: "futureshops",
    dsl: "groovy"
  },

  assets: {
    projectIcon: {
      source: "upload:project-icon",
      outputPath: "src/main/resources/futureshops.png",
      transform: "fit-square"
    }
  },

  features: {
    mixins: true,
    parchment: true,
    dependabot: true,
    githubActions: true
  }
})
```

The accepted configuration is a versioned `ProjectSpec`, not a fixed set of form fields. It must support nested metadata, build, dependencies, repositories, source layout, features, assets, publishing, GitHub, file overrides, and platform-specific extension blocks.

Configuration resolution order:

```text
template defaults
recommended compatibility selections
imported project specification
interactive user changes
explicit target-specific overrides
raw file overrides
```

Resolve into temporary immutable state, validate the complete cross-field model, then generate. Invalid edits must not partially mutate the last valid preview. Every resolved field should retain provenance so the UI can explain whether a value came from the template, a recommended default, an imported configuration, a user edit, or a raw override.

---

# 14. Generator Output Model

The generator should return a virtual file tree instead of immediately writing files.

Example:

```typescript
interface GeneratedProject {
  files: GeneratedFile[];
  metadata: ProjectMetadata;
  warnings: GeneratorWarning[];
  validation: ValidationResult;
  resolvedSpec: ProjectSpec;
  fieldImpacts: FieldImpact[];
  artifactPreviews: GeneratedArtifactPreview[];
}

interface GeneratedFile {
  path: string;
  content: string | Uint8Array;
  executable?: boolean;
  mediaType?: string;
  origin: "template" | "generated" | "uploaded" | "override";
}
```

Binary file content, including uploaded PNG icons, must remain `Uint8Array` from input through ZIP, local filesystem, API, and GitHub adapters. It must never pass through text encoding or placeholder replacement.

The output model should also support deterministic file operations:

```text
add
modify
rename
delete
preserve
conflict
```

Each operation must identify the configuration field or raw override that caused it. This powers the live file tree, change preview, porting preview, and reproducible tests.

This allows the same generated project to be sent to:

- ZIP
- Local filesystem
- GitHub
- API
- CLI
- IDE extension

---

# 15. Output Adapters

Create separate adapters.

```text
packages/
  generator-core/
  adapter-zip/
  adapter-local/
  adapter-github/
```

Potential future adapters:

```text
adapter-gitlab
adapter-gitea
adapter-bitbucket
```

---

# 16. Website

Recommended stack:

```text
React
TypeScript
Vite
```

Production hosting:

```text
https://mcgen.enviouse.com
Cloudflare edge
Dedicated Cloudflare Tunnel
Custom Nginx origin
```

The website and API should use one public origin:

```text
/
  Static Vite application served by Nginx

/api/v1/*
  Reverse-proxied by Nginx to the private API service

/auth/github/*
  GitHub App authorization and installation callbacks

/webhooks/github
  GitHub App webhook receiver
```

GitHub Pages, Cloudflare Pages, Cloudflare Workers, Vercel, and Netlify are not production hosting targets for MCGen.

The recommended backend stack is TypeScript on the repository-pinned active LTS Node.js release. Fastify is the preferred HTTP framework because the generator packages are already TypeScript and the API needs explicit schemas, bounded request bodies, structured logging, and predictable plugin boundaries.

The origin should run as an isolated deployment stack containing:

```text
cloudflared
nginx
mcgen-api
optional database added only when persistent API keys or durable jobs require it
```

Only `cloudflared` should have public network reachability. Nginx and the API should remain on a private container or loopback network with no public host ports.

Only GitHub-authenticated actions require backend functionality.

ZIP generation can happen fully inside the browser.

This separation preserves anonymous generation during API outages. A user should still be able to browse templates and download a ZIP when GitHub authentication or the backend is unavailable.

---

# 17. Website User Flow

## Step 1 — Project Type

```text
Mod
Plugin
Proxy
```

---

## Step 2 — Platform

For Mod:

```text
Forge
NeoForge
Fabric
Architectury
MultiLoader
```

`MultiLoader` is a project layout choice rather than a loader. Its editor must let the user choose target loaders, shared and target source sets, linked or target-specific metadata, per-target versions and dependencies, artifact classifiers, and aggregate build behavior.

For Plugin:

```text
Bukkit
Spigot
Paper
Sponge
```

For Proxy:

```text
Velocity
BungeeCord
```

---

## Step 3 — Minecraft Version

Display only versions compatible with selected platform.

Example:

```text
1.8.9
1.12.2
1.16.5
1.18.2
1.19.2
1.20.1
1.21.1
26.1
```

---

# 18. Dynamic Configuration Forms

The UI must be generated from the selected template's configuration schema and capability declarations. Platform selection changes the schema, defaults, compatibility data, help text, validation, generated targets, and preview. It must not switch between hardcoded form components that drift from the CLI or API.

Every supported project exposes these configuration groups when applicable:

```text
Project
  project name, directory name, description, license, authors, contributors, credits, contact links

Platform
  project category, platform, Minecraft version, loader version, mappings, APIs, language, Java toolchain

Identifiers
  mod or plugin ID, display name, group ID, artifact ID, archives base name, package, main classes, namespaces

Version and artifacts
  project version, release channel, prerelease label, build metadata, classifier, appendix, archive filename preview

Metadata
  every field supported by the selected loader or platform metadata format

Assets
  project icon or logo upload, output path, normalization, other resource uploads supported by the template

Build
  Gradle DSL, wrapper, plugins, properties, repositories, dependencies, configurations, source sets, tasks, JVM arguments, manifests

Features
  mixins, data generation, access transformers, access wideners or class tweakers, split sources, tests, run profiles

Publishing
  Maven publishing, Modrinth, CurseForge, GitHub Releases, signing placeholders, artifact selection

Repository
  README, license file, Git initialization, Actions, Dependabot, issue templates, branch and pull-request destination

Files
  live generated tree, structured editors, raw text editor, uploads, add, rename, delete, reset, and diff
```

## Mod Metadata

Expose all version-supported fields for the selected loader. The schema must cover at least:

```text
mod ID and display name
project version source or literal override
description
authors, contributors, and credits
license or licenses
homepage, source, issues, update, Discord, and custom contact links
icon or logo path
client, server, or both environment
entrypoints and language adapters
mixins and their environments
access widener, class tweaker, or access transformer
provided IDs
required, recommended, suggested, incompatible, and conflicting dependencies
dependency version ranges, ordering, and logical side when supported
loader-specific services, features, display tests, namespaces, and custom fields
```

Fabric, Forge, NeoForge, Architectury, and multiloaders do not share identical metadata. Each versioned template must define exact field mappings. Unknown loader-specific keys can be added through a namespaced custom-fields editor or raw metadata editor.

## Plugin Metadata

Expose all fields supported by the selected Bukkit, Spigot, Paper, or Sponge metadata format, including:

```text
name, main class, bootstrapper, loader, and version
description, authors, contributors, website, prefix, and log prefix
API version and load phase
commands with descriptions, usage, aliases, permissions, and permission messages
permission nodes with defaults, descriptions, and children
hard dependencies, soft dependencies, load-before rules, provided aliases, and libraries
Paper dependency graph properties such as bootstrap or server phase, load order, required state, and classpath joining
platform-specific custom fields
```

The editor must prevent dependency cycles and duplicate command, permission, and dependency keys.

## Proxy Metadata

Expose all fields supported by Velocity and BungeeCord templates, including identity, main class, version, authors, description, URL, dependency declarations, optionality, and platform-specific extension fields.

## Visibility and Availability

Simple mode displays only the essential fields supported by the selected template and automatically applies compatible recommended component versions. Advanced mode exposes every structured field, including uncommon or incompatible values with an explanation and confirmation. Its raw file workspace may override a complete file, but the project becomes `custom-unverified` when MCGen can no longer prove compatibility.

Changing an upstream choice must not silently erase downstream edits. Preserve dormant values when a section becomes temporarily unavailable, show what is inactive, and require confirmation only when generation would permanently discard an override.

---

# 19. Destination Selector

After project configuration:

```text
Where should this project go?
```

Options:

1. Download ZIP
2. Create New GitHub Repository
3. Existing GitHub Repository
4. CLI / API instructions

---

# 20. Download ZIP

The browser should:

1. Load the template.
2. Resolve and validate the complete `ProjectSpec`.
3. Decode and validate uploaded PNG assets locally.
4. Generate structured metadata, build files, sources, resources, and raw overrides.
5. Show the final tree, validation result, artifact name, and diff from template defaults.
6. Package text and binary files client-side.
7. Download:

```text
ProjectName.zip
```

No account should be required.

Uploaded icons and other local assets must remain in browser memory for anonymous ZIP generation. They must not be uploaded to MCGen merely to create a local archive.

---

# 21. New GitHub Repository Flow

The user selects:

```text
New GitHub Repository
```

Fields:

```text
Owner
Repository Name
Description
Visibility
Default Branch
```

Options:

```text
Public
Private

Enable Dependabot
Enable GitHub Actions
Add README
Add LICENSE
```

The system then:

1. Authenticates GitHub user.
2. Generates project.
3. Creates repository.
4. Uploads complete project tree.
5. Creates one initial commit.
6. Returns repository URL.

---

# 22. Existing Repository Flow

This is one of MCGen's flagship features.

The user selects:

```text
Existing Repository
```

Then chooses:

```text
Owner
Repository
Source Branch
Target Branch
Mode
```

---

# 23. Existing Repository Modes

## Mode A — Clean Template Branch

Example:

```text
FutureShops
  main
  1.20.1
```

Create:

```text
FutureShops
  main
  1.20.1
  neoforge-1.21.1
```

The target branch contains a new blank generated template.

---

## Mode B — Port Existing Project

Example:

```text
Source:
1.20.1

Target:
1.21.1
```

The generator should:

1. Clone/use source branch Git tree.
2. Preserve user source code.
3. Replace/update project infrastructure.
4. Add missing target files.
5. Remove explicitly obsolete generated files only when safe.
6. Commit the result to the new branch.

Result:

```text
FutureShops
  main
  1.20.1
  1.21.1
```

---

# 24. Porting Safety Model

MCGen must never blindly overwrite user code.

Files should be classified.

### Managed files

MCGen may replace:

```text
build.gradle
build.gradle.kts
settings.gradle
settings.gradle.kts
gradle.properties
gradle/wrapper/*
gradlew
gradlew.bat
loader metadata files
CI template files
Dependabot configuration
```

### Preserved files

Normally preserve:

```text
src/main/java/**
src/main/kotlin/**
src/main/resources/assets/**
src/main/resources/data/**
README.md
LICENSE
custom documentation
```

### Conditional files

Require preview/merge logic:

```text
mods.toml
neoforge.mods.toml
fabric.mod.json
plugin.yml
paper-plugin.yml
mixins.json
```

---

# 25. Change Preview

Before modifying an existing repository, show:

```text
Modified
M build.gradle
M settings.gradle
M gradle.properties

Added
+ .github/dependabot.yml
+ .github/workflows/build.yml
+ src/main/resources/futureshops.png

Raw overrides
! build.gradle

Preserved
✓ src/main/java/
✓ src/main/resources/assets/
✓ README.md

Removed
- obsolete-loader-file

Verification
Custom Validated
```

The user must be able to preview these changes before deployment.

The preview must identify the responsible field, uploaded asset, structured target override, or raw file operation for every change. Binary files show digest, media type, dimensions where applicable, and byte size instead of an unreadable text diff.

---

# 26. Existing Repository Deployment Modes

Offer:

```text
Create branch directly
Create branch + Pull Request
Preview only
```

Recommended default:

```text
Create branch + Pull Request
```

for existing repositories.

---

# 27. GitHub Authentication

## Website

Use a GitHub App.

Benefits:

- Fine-grained repository access.
- User can select specific repositories.
- Better permission control.
- Cleaner security model than asking users for PATs.

Use two distinct GitHub token types for different responsibilities:

```text
GitHub App user access token
  Confirms the signed-in user and performs user-scoped operations such as creating a repository.

GitHub App installation access token
  Reads and writes only repositories selected during installation.
```

Installation access tokens should be minted on demand, narrowed to the selected repository and required permissions, cached only until shortly before expiry, and never sent to the browser. User access tokens should use GitHub's expiring-token option. MCGen should not persist refresh tokens for the MVP. The user signs in again after the session expires.

Required authorization controls:

```text
OAuth state validation
PKCE with S256
exact callback URL matching
host-only Secure HttpOnly SameSite=Lax session cookie
session identifier rotation after authorization
server-side token storage only
logout revocation and server-side session deletion
```

Baseline repository permissions for existing-repository features:

```text
Repository Contents: Read & Write
Metadata: Read
Pull Requests: Read & Write
Workflows: Read & Write only when generated output can write .github/workflows files
```

The new-repository feature creates a separate permission decision. GitHub currently requires `Administration: Read & Write` for a GitHub App user access token to create a repository for the authenticated user. That permission is broad and is shown during app installation. Before the public GitHub App is registered, choose one of these product policies:

1. Keep new-repository creation in the primary app and clearly explain the Administration permission.
2. Keep the primary app minimal and move new-repository creation to a separately installed repository-creator app.
3. Defer new-repository creation from the web MVP while retaining it in the CLI through the user's existing `gh` authentication.

Recommended policy: option 2. Existing-repository generation is the flagship feature and should not require Administration permission. A separate optional creator app gives users a smaller default trust grant.

GitHub App endpoints:

```text
Homepage
https://mcgen.enviouse.com/

Authorization callback
https://mcgen.enviouse.com/auth/github/callback

Installation setup callback
https://mcgen.enviouse.com/auth/github/setup

Webhook receiver
https://mcgen.enviouse.com/webhooks/github
```

Subscribe only to events used by implemented behavior. The initial allowlist should contain installation lifecycle events and installation repository selection changes. Pull request events are unnecessary unless MCGen later reconciles or reports PR state asynchronously.

Every webhook request must be verified against the exact raw body with `X-Hub-Signature-256`, using a constant-time comparison. Deduplicate accepted deliveries by `X-GitHub-Delivery`. Reject unsupported event names and actions before enqueueing work.

Use the smallest permissions possible. Document every permission beside the exact API calls that require it. Permission changes after launch require a security review because installations must approve increased access.

---

# 28. CLI Authentication

Prefer existing GitHub CLI authentication.

The CLI can use:

```bash
gh auth status
```

If authenticated, use the available GitHub session.

If not:

```bash
gh auth login
```

Alternative advanced option:

```text
GITHUB_TOKEN
```

---

# 29. GitHub Write Strategy

Do not create one commit per file.

Use Git data operations:

```text
base commit
   ↓
base tree
   ↓
generated blobs
   ↓
new tree
   ↓
single commit
   ↓
branch ref
```

Expected result:

```text
Bootstrap NeoForge 1.21.1 development environment
```

as one clean commit.

---

# 30. CLI

Possible package/binary name:

```text
mcgen
```

Interactive command:

```bash
mcgen
```

or:

```bash
mcgen create
```

---

# 31. CLI Commands

Recommended initial commands:

```bash
mcgen create
mcgen github create
mcgen github branch
mcgen templates
mcgen platforms
mcgen versions
mcgen validate
```

---

# 32. CLI — Local Project

Example:

```bash
mcgen create \
  --platform neoforge \
  --minecraft 1.21.1 \
  --language java \
  --name FutureShops \
  --mod-id futureshops \
  --package com.example.futureshops
```

Output:

```text
./FutureShops
```

---

# 33. CLI — New GitHub Repository

Example:

```bash
mcgen github create FutureShops \
  --owner EnVy \
  --platform neoforge \
  --minecraft 1.21.1 \
  --language java \
  --mod-id futureshops \
  --package com.example.futureshops \
  --mixins \
  --parchment \
  --public
```

---

# 34. CLI — Existing Repository Branch

Example:

```bash
mcgen github branch EnVy/FutureShops \
  --from 1.20.1 \
  --branch 1.21.1 \
  --platform neoforge \
  --minecraft 1.21.1 \
  --language java \
  --mode port
```

---

# 35. CLI Interactive Flow

Example:

```text
? Project type
  Mod
  Plugin
  Proxy

? Platform
  NeoForge

? Minecraft version
  1.21.1

? Language
  Java

? Destination
  Local
  ZIP
  New GitHub Repository
  Existing GitHub Repository
```

---

# 36. Public API

Base version:

```text
/api/v1
```

Possible endpoints:

```text
GET  /platforms
GET  /platforms/:platform
GET  /platforms/:platform/versions

GET  /templates/:platform/:minecraft

POST /generate
POST /github/repositories
POST /github/branches
POST /github/pull-requests

POST /validate
```

---

# 37. API — Generate

Example:

```http
POST /api/v1/generate
```

```json
{
  "schemaVersion": 1,
  "platform": "neoforge",
  "minecraft": "1.21.1",
  "language": "java",
  "project": {
    "name": "FutureShops",
    "id": "futureshops",
    "package": "com.example.futureshops",
    "mainClass": "FutureShops",
    "description": "Server shops with a modern trading workflow",
    "authors": [{ "name": "EnVy" }],
    "license": "MIT"
  },
  "build": {
    "group": "com.example",
    "artifactId": "futureshops",
    "version": "1.0.0-beta.1",
    "archivesBaseName": "futureshops",
    "dsl": "groovy"
  },
  "features": {
    "mixins": true,
    "dataGeneration": true
  },
  "assets": {
    "projectIcon": {
      "part": "project-icon",
      "outputPath": "src/main/resources/futureshops.png"
    }
  },
  "overrides": {
    "metadata": {},
    "files": []
  }
}
```

When a request contains uploaded assets, use `multipart/form-data` with one JSON `spec` part and content-addressed binary parts referenced by the spec. JSON-only requests may embed neither filesystem paths nor remote URLs that the server fetches implicitly.

Every API request must use the same versioned `ProjectSpec` schema as the library, CLI, and web application. Partial convenience requests may be accepted, but the response must include the fully resolved specification with defaults and provenance.

Possible outputs:

```text
manifest
zip
file-tree
resolved-spec
validation-report
template-diff
artifact-preview
```

---

# 38. API — Existing Repository Port

Example:

```http
POST /api/v1/github/branches
```

```json
{
  "repository": "EnVy/FutureShops",
  "sourceBranch": "1.20.1",
  "targetBranch": "1.21.1",
  "mode": "port",
  "template": {
    "platform": "neoforge",
    "minecraft": "1.21.1",
    "language": "java",
    "mixins": true,
    "parchment": true
  }
}
```

---

# 39. API Result

Example:

```json
{
  "status": "created",
  "repository": "EnVy/FutureShops",
  "sourceBranch": "1.20.1",
  "targetBranch": "1.21.1",
  "commit": "abcdef123456",
  "filesAdded": 4,
  "filesModified": 8,
  "filesRemoved": 1
}
```

---

# 40. Generator API as a Library

Publish:

```text
@mcgen/core
```

Example:

```typescript
import { generateProject } from "@mcgen/core";

const result = await generateProject({
  spec,
  assets: {
    async read(digest) {
      return assetBytesByDigest.get(digest);
    }
  }
});
```

The core library must remain deterministic and effect-free. It receives a validated specification, a pinned template snapshot, and an asset resolver. It does not read the filesystem, fetch URLs, call GitHub, inspect browser state, or execute generated builds.

This allows integration into:

- VS Code.
- JetBrains.
- GitHub Actions.
- Modding websites.
- CI pipelines.
- Third-party launchers.
- custom internal tools.

---

# 41. GitHub Actions

Generated projects should optionally include:

```text
.github/workflows/build.yml
```

Basic behavior:

```text
push
pull_request
```

Steps:

```text
checkout
setup-java
setup-gradle
./gradlew build
```

The correct JDK must be selected automatically.

---

# 42. Dependabot

Generated repositories should optionally include:

```text
.github/dependabot.yml
```

Targets:

```text
Gradle
GitHub Actions
```

Optional future:

```text
npm
Docker
```

for projects that include extra tooling.

---

# 43. Template Maintenance Automation

The central MCGen repository should **not rely only on Dependabot**.

Create dedicated workflows.

Responsibilities:

- Check current platform releases.
- Detect dependency updates.
- Open maintenance PRs.
- Validate Gradle.
- Test template build.
- Update registry status.

---

# 44. Template Build Verification

Every template branch should be regularly tested.

Example:

```text
forge/1.8.9
  Java 8
  ./gradlew build

forge/1.20.1
  Java 17
  ./gradlew build

neoforge/1.21.1
  Java 21
  ./gradlew build
```

---

# 45. Build Matrix

Maintain a central matrix:

```text
Platform   Minecraft   Java   Status

Forge      1.8.9       8      passing
Forge      1.12.2      8      passing
Forge      1.20.1      17     passing

Fabric     1.21.1      21     passing

NeoForge   1.21.1      21     passing
NeoForge   26.1        TBD    passing
```

---

# 46. Website Compatibility Indicator

Show users:

```text
NeoForge 1.21.1

Status: Verified
Java: 21
Mixins: Supported
Parchment: Supported
Data Generation: Supported
Last Tested: <timestamp>
Build: Passing
```

Legacy example:

```text
Forge 1.8.9

Status: Legacy Verified
Java: 8
Build: Passing
Legacy Toolchain Warning
```

---

# 47. Automated Release Monitoring

Long-term automation can watch:

- Minecraft releases.
- Forge versions.
- NeoForge versions.
- Fabric loader.
- Fabric API.
- Paper API.
- Velocity.
- Sponge.
- Gradle plugins.
- Parchment mappings.

When a new compatible release appears:

1. Create update branch.
2. Update template.
3. Run build test.
4. Open PR.
5. Merge after validation.

---

# 48. Legacy Compatibility

Legacy development is a major MCGen feature.

Legacy templates must preserve appropriate:

- Gradle versions.
- ForgeGradle versions.
- Java versions.
- repository definitions.
- mappings.
- JVM arguments.
- compatibility workarounds.

Do **not** force modern tooling onto legacy versions if it makes the project unstable.

---

# 49. Java Toolchain Management

The registry should store:

```json
{
  "java": 8
}
```

or:

```json
{
  "java": 17
}
```

or:

```json
{
  "java": 21
}
```

The web UI should clearly display the required Java version.

The CLI should detect installed Java versions.

Possible future command:

```bash
mcgen doctor
```

Output:

```text
Java 8    ✓
Java 17   ✓
Java 21   ✓
Git       ✓
GitHub CLI ✓
```

---

# 50. Validation Command

Implement:

```bash
mcgen validate
```

Checks:

- Gradle wrapper exists.
- Required Java version.
- Project metadata.
- Loader metadata.
- Mod/plugin ID validity.
- package names.
- build files.
- optional feature configuration.
- project, loader, API, mapping, Gradle plugin, Gradle wrapper, and Java compatibility.
- project version syntax and target ecosystem compatibility.
- group, artifact, archive, classifier, task, source-set, and configuration names.
- metadata required fields, types, duplicate keys, unsupported keys, and version ranges.
- consistency between Gradle properties, loader metadata, source packages, entrypoints, resources, publishing, and artifact previews.
- repository URL schemes, duplicate repositories, insecure HTTP repositories, and repository-content filters.
- dependency coordinate syntax, duplicate declarations, incompatible configurations, cycles, and conflicting loader dependency rules.
- uploaded PNG signature, decoded dimensions, pixel budget, file size, output path, and metadata reference.
- file override collisions, path traversal, absolute paths, reserved names, case-folding collisions, invalid encodings, and forbidden symlinks.
- raw override syntax for JSON, TOML, YAML, XML, properties, Groovy DSL, and Kotlin DSL where parsers are available.
- unresolved placeholders and stale generated-file references.

Future:

```bash
mcgen validate --build
```

runs:

```bash
./gradlew build
```

`mcgen validate --build` may execute only on the user's local machine or inside an explicitly isolated build environment. The public MCGen API must never run arbitrary user-customized Gradle logic.

Validation outcomes:

```text
verified
  The resolved specification stays inside a canonical template's verified capability envelope.

custom-validated
  Static validation passes, but the configuration is outside the template's tested matrix.

custom-unverified
  Raw overrides or unsupported values prevent MCGen from proving compatibility.

invalid
  Generation or deployment is blocked until errors are resolved.
```

---

# 51. Project Naming Validation

Examples:

### Mod ID

Should enforce platform-specific rules.

Example:

```text
future_shops
```

not:

```text
Future Shops
```

### Java package

Valid:

```text
com.example.futureshops
```

Invalid:

```text
com.Future Shops
```

The website and CLI should validate before generation.

---

# 52. Advanced Options

Advanced customization is a launch requirement, not deferred scope.

Advanced controls include:

```text
Mappings
Parchment version
Mixin version
Gradle plugin version
Gradle wrapper version
Loader version
API version
Java toolchain
Kotlin version
Gradle Groovy or Kotlin DSL
group ID
artifact ID
project version
archives base name, appendix, classifier, extension, and complete filename override
Gradle properties and JVM arguments
plugin management and dependency repositories
dependencies and configurations
source sets and resource directories
run configurations and data-generation runs
JAR manifest attributes
resource expansion and token mappings
publishing repositories and publications
GitHub Actions and release configuration
loader metadata fields
raw generated-file overrides
```

Simple mode should select recommended compatible component versions automatically.

Advanced sections should be searchable and reachable without restarting the wizard. A global `Show all fields` control should reveal every schema-supported value and its generated-file impact.

The raw file workspace inside Advanced mode must permit full replacement of generated text files, adding new text files, renaming files, and deleting template files. Raw changes are included in previews and exported configuration. They may change verification status to `custom-unverified`, but MCGen must not silently discard them.

---

# 53. Simple and Advanced Modes

Offer:

```text
Simple
Advanced
```

Simple mode is the default. It presents a compact guided flow containing:

```text
project type and platform
Minecraft version and programming language
project name, mod or plugin ID, package, and main class
project version, including alpha, beta, release candidate, snapshot, and custom values
description, authors, website, license, and PNG icon
common platform features
output destination
```

Simple mode automatically selects a tested compatible loader, mappings, API, Java toolchain, Gradle plugin, and Gradle wrapper combination. The user may inspect these resolved values without having to configure them. It must remain possible to create a valid project without opening Advanced mode.

Advanced mode exposes every schema-supported field described throughout this plan. It supports manual component versions, snapshots, uncommon or unsupported combinations after a clear compatibility warning, custom metadata, Gradle configuration, repositories, dependencies, source layout, runs, tasks, publishing, repository automation, and target-specific overrides.

The generated file tree and syntax-aware raw file workspace are tools inside Advanced mode, not a third top-level mode. They are the final escape hatch for complete customization.

Mode switching must preserve user intent:

- Switching from Simple to Advanced reveals the exact resolved values and fields already selected by Simple mode.
- Switching from Advanced to Simple never deletes, resets, or normalizes advanced values, uploaded assets, custom fields, or raw file operations.
- Active advanced overrides remain effective and appear in Simple mode as a visible summary such as `4 advanced overrides active`.
- The summary links directly to each affected Advanced section and offers an explicit reviewed `Reset advanced overrides` action.
- Switching back to Advanced restores the same section state, values, raw edits, and validation results.
- A Simple-mode edit that conflicts with an active advanced override must explain the conflict and ask whether to update, retain, or reset that override.

Recommended, snapshot, and manual component-version selection are policies within the two modes. They are not additional customization modes.

## 53.1 Simple Mode Contract

Simple mode must remain one short guided path. Platform adapters declare which fields are essential, their order, help text, defaults, and compatibility dependencies. A template cannot publish as Verified unless its Simple flow generates and builds a valid project using only user identity inputs and recommended compatible defaults.

Simple mode must still expose the choices users commonly personalize on every project, including the project version, license, authors, description, icon, environment, mixin or API toggles when relevant, and destination. It must not hide these behind Advanced merely because a compatible default exists.

Simple mode must never hide a condition that affects generation. Active advanced overrides, raw operations, compatibility warnings, invalid fields, and `custom-unverified` status remain visible in the summary even when their editors are hidden.

## 53.2 Advanced Mode Contract

Advanced mode contains the complete structured editor and the raw file workspace. Its navigation groups fields by Project, Platform, Metadata, Version and Artifacts, Assets, Build, Dependencies, Sources, Runs, Features, Publishing, Repository, and Files. Every group is searchable, deep-linkable, and may be collapsed without making its values inactive.

Each advanced field shows:

```text
stable field label and field ID
current value and value type
default or derived value
value provenance
compatibility range or constraint
generated files and keys affected
reset behavior
verification impact
```

Advanced mode provides `Show changed fields`, `Show incompatible fields`, and `Show all fields` filters. It may hide fields that are impossible for the selected template, but it must explain why and preserve any dormant values from another platform selection.

## 53.3 Mode State and Validation

Mode changes are presentation changes, not destructive schema transformations. The same ProjectSpec resolver and validators run in both modes. The selected mode changes field visibility and default interaction policy, but it does not create a different generator or output format.

Validation must identify the owning section and remain actionable from either mode. If an error belongs to a hidden Advanced field, Simple mode displays it in the summary with an `Open in Advanced` action. Generation is never blocked by a hidden error without that direct path.

The mode selector, active override count, and current verification status remain visible on desktop and mobile. Mode switching participates in undo and redo, but undoing the switch changes presentation only and does not undo the field edits made before it.

Platform component versions and the generated project's own version are separate concepts. The project version editor must support:

```text
1.0.0
1.0.0-alpha.1
1.0.0-beta.1
1.0-beta
1.0.0-rc.1
1.0.0-SNAPSHOT
1.0.0+mc1.21.1
1.0.0-beta.1+build.42
free-form version strings when the selected ecosystem accepts them
```

Provide both a structured composer and a raw value:

```text
base version
prerelease channel
prerelease number or label
build metadata
raw final version
```

Show the resolved Gradle `version`, metadata version, Maven coordinate, and output artifact filenames live. Do not automatically rewrite user capitalization such as `SNAPSHOT` or custom channel names.

---

# 54. Generated README

Optionally generate a simple project README:

```markdown
# FutureShops

Minecraft 1.21.1 NeoForge mod.

## Development

Java 21

```bash
./gradlew build
```
```

README generation must be configurable. Users can select sections, edit badges and links, add installation and publishing details, disable the file, or replace it completely through the raw file workspace in Advanced mode. Generated version, platform, Java, artifact, build, and license information comes from the resolved ProjectSpec.

---

# 55. License Handling

Provide common choices:

```text
MIT
Apache-2.0
GPL-3.0
LGPL-3.0
MPL-2.0
All Rights Reserved
Custom
```

If the user chooses a standard license, generate the correct license file.

Advanced mode supports SPDX expressions, multiple licenses where the platform permits them, custom license identifiers, custom license text, copyright holder, year range, and target-specific metadata overrides. The user may disable license-file generation or replace the generated file through the Advanced raw file workspace.

---

# 56. GitHub Repository Settings

When creating a new repository, optional settings:

```text
Public / Private
Issues
Discussions
Wiki
Projects
Dependabot
Actions
Branch protection
```

Keep advanced repository settings optional.

---

# 57. Branch Naming

Recommended default for porting:

```text
1.21.1
```

Optional formats:

```text
mc-1.21.1
neoforge-1.21.1
port/1.21.1
```

The website should let the user choose.

---

# 58. Pull Request Generation

For porting mode:

```text
Source:
1.20.1

Generated:
port/1.21.1

PR:
Port project to NeoForge 1.21.1
```

Generated PR description:

```text
MCGen created the initial NeoForge 1.21.1 development environment.

Preserved:
- source code
- assets
- data

Updated:
- Gradle configuration
- loader metadata
- Java toolchain
- GitHub Actions
- Dependabot

Manual source-code changes may still be required.
```

---

# 59. Porting Manifest

When MCGen manages a repository, optionally add:

```text
.mcgen/project.json
```

Example:

```json
{
  "schemaVersion": 1,
  "platform": "neoforge",
  "minecraft": "1.21.1",
  "template": "neoforge/1.21.1",
  "templateRevision": 7,
  "templateCommit": "<commit-sha>",
  "projectSpecDigest": "sha256:<digest>",
  "assetDigests": {
    "projectIcon": "sha256:<digest>"
  },
  "verificationStatus": "custom-validated"
}
```

This makes future updates safer.

The user may optionally track a secret-free portable configuration at:

```text
.mcgen/project.mcgen.json
```

Tracking the configuration improves reproducibility and upgrades, but must remain optional. The file must never contain credentials, local paths, browser state, or embedded large binaries. Assets remain ordinary project files and are linked by digest.

---

# 60. Managed File Tracking

Optionally store:

```text
.mcgen/managed-files.json
```

Example:

```json
{
  "files": {
    "build.gradle": {
      "digest": "sha256:<digest>",
      "origin": "structured-generated",
      "fields": ["build.version", "build.dependencies"]
    },
    "src/main/resources/META-INF/neoforge.mods.toml": {
      "digest": "sha256:<digest>",
      "origin": "raw-override",
      "fields": []
    }
  }
}
```

This helps MCGen know which files it may safely replace during future updates. Tracking must distinguish template files, structured output, uploaded assets, and raw overrides. An upgrade must never regenerate over a raw override without an explicit conflict decision.

---

# 61. Conflict Detection

Before overwriting managed files:

1. Compare previous generated version.
2. Compare current repository version.
3. Detect local user edits.

If edited:

```text
Conflict detected
```

Options:

```text
Keep repository version
Use new template version
Open side-by-side diff
Generate .mcgen-new file
```

---

# 62. Safe Upgrade Workflow

Future command:

```bash
mcgen upgrade
```

Example:

```text
Current:
NeoForge 1.21.1

Available template update:
NeoForge 1.21.1 template revision 8
```

Then show changes before applying.

---

# 63. Website Layout

Suggested primary pages:

```text
/
  Landing page

/create
  Generator

/templates
  Platform/version browser

/templates/:platform/:version
  Template details

/docs
  Documentation

/api
  API docs

/status
  Template build status
```

---

# 64. Generator UI Layout

Desktop:

```text
Top bar
  project name, Simple or Advanced segmented mode selector, import, export, reset, undo, redo, generate

Left navigation
  searchable configuration sections
  Project
  Platform
  Metadata
  Version and Artifacts
  Assets
  Build
  Dependencies
  Features
  Publishing
  Repository
  Files

Center editor
  schema-driven controls for the active section
  repeatable lists and structured tables
  advanced disclosure panels similar to the supplied IntelliJ generator reference

Right inspector
  live project summary
  icon preview
  resolved versions
  artifact filename preview
  compatibility and verification status
  validation errors and warnings
  affected files
  destination selector

Bottom or resizable workspace
  generated file tree
  structured or raw file editor
  template diff
  final output diff
```

Mobile:

```text
Step-based wizard
searchable section drawer
sticky validation and artifact summary
separate full-screen file editor
```

The screenshots establish the minimum interaction density: platform and toolchain selections remain visible, optional settings are collapsible, and build system properties such as group, artifact, project version, and JDK are first-class controls. MCGen should extend that model rather than copy its fixed field limitations.

Required interaction behavior:

- The mode selector has exactly two choices, `Simple` and `Advanced`; the raw file editor appears only as an Advanced workspace.
- Simple mode uses a compact ordered wizard and hides nonessential sections while keeping advanced override and validation summaries visible.
- Advanced mode uses the full section navigation, structured editors, filters, generated file tree, and raw file workspace.
- Switching modes is immediate, requires no regeneration confirmation, and preserves all values, assets, expanded-state preferences, raw operations, and undo history.
- Every field shows its current source and reset target.
- Every field can show which files and keys it changes.
- Linked values can be unlocked for target-specific overrides.
- Repeated metadata such as authors, dependencies, commands, and permissions uses reorderable structured rows.
- Version selectors support recommended values, snapshots, manual values, and compatibility warnings.
- Search finds fields by label, generated key, file path, or common alias.
- Undo and redo operate across form edits, uploads, file changes, and platform switches.
- Import and export use the same versioned `ProjectSpec` consumed by the CLI and API.
- The application can save a draft locally without uploading the project or image.

---

# 65. Project Summary Panel

Example:

```text
FutureShops

Type
Mod

Platform
NeoForge

Minecraft
1.21.1

Language
Java

Java
21

Features
✓ Mixins
✓ Parchment
✓ Dependabot
✓ GitHub Actions

Project Version
1.0.0-beta.1

Artifact
futureshops-1.0.0-beta.1.jar

Icon
futureshops.png

Customization
12 values changed from recommended defaults
2 raw file overrides

Template
neoforge/1.21.1

Status
Custom Validated
```

The summary must distinguish the Minecraft version, loader version, API version, Java version, Gradle version, and project artifact version. These values must never be presented as one ambiguous `Version` field.

---

# 66. Template Browser

Users should also be able to browse templates directly.

Example:

```text
Forge
  1.8.9   Legacy Verified
  1.12.2  Legacy Verified
  1.16.5  Verified
  1.20.1  Verified

NeoForge
  1.20.4  Verified
  1.21.1  Verified
  26.1    Verified
```

Clicking one shows:

- Java requirement.
- Build status.
- Loader/tool versions.
- Supported features.
- Branch.
- clone command.

---

# 67. Direct Git Clone Workflow

Power users should always be able to:

```bash
git clone \
  --branch neoforge/1.21.1 \
  --single-branch \
  https://github.com/MCEnvision/MCGen-Templates.git \
  FutureShops
```

This bypasses the generator entirely.

---

# 68. Production Deployment

MCGen will not use GitHub Pages. Production is served from:

```text
https://mcgen.enviouse.com
```

Recommended request path:

```text
Browser
  Cloudflare DNS, TLS, CDN, managed WAF, and DDoS protection
  Dedicated mcgen-prod Cloudflare Tunnel
  Nginx
    static Vite files for /
    reverse proxy for /api/v1/
    reverse proxy for /auth/github/
    reverse proxy for /webhooks/github
  Private mcgen-api service
  GitHub API
```

Cloudflare Tunnel is preferred over a proxied public A or AAAA record because the connector opens outbound connections and allows all inbound origin ports to remain closed. Do not reuse the existing `ezconfig-hermes` tunnel. MCGen needs a dedicated tunnel so its credentials, route changes, restarts, and incident response do not affect another application.

Target tunnel configuration:

```yaml
ingress:
  - hostname: mcgen.enviouse.com
    service: http://nginx:8080
  - service: http_status:404
```

If services run directly on the host instead of a private container network, use `http://127.0.0.1:<port>`. Do not publish the Nginx port on the server's public interface.

Target DNS record after the tunnel connector is installed and healthy:

```text
Type: CNAME
Name: mcgen
Target: <mcgen-prod-tunnel-id>.cfargotunnel.com
Proxy: enabled
TTL: automatic
```

Do not create the DNS record before the connector and Nginx health checks pass. A DNS record and a tunnel are independent, so an unconnected tunnel produces a public Cloudflare error instead of a staged deployment.

## Deployment pipeline

GitHub-hosted runners should build and verify MCGen. The production server should only run a restricted deployment command against an already verified artifact.

```text
Pull request
  formatting, lint, unit, integration, web, security, and packaging checks

Approved merge to main
  reproducible web and API artifacts
  SHA-256 and SHA-512 checksums
  source commit manifest
  SPDX SBOM

Signed release tag or approved deployment
  restricted server-side deploy command
  staged extraction or image pull
  configuration validation
  health checks
  atomic activation
  smoke test through https://mcgen.enviouse.com
```

Keep the previous two known-good releases on the server. Deployment must automatically restore the prior release when configuration validation, readiness checks, or the external smoke test fails.

The production server must never compile untrusted pull-request code and must not act as a general-purpose self-hosted GitHub Actions runner.

---

# 69. Backend Requirements

A backend is required for:

- GitHub App authentication.
- GitHub repository creation.
- GitHub branch writes.
- Pull Request creation.
- secure GitHub token exchange.
- API authentication.
- rate limiting.
- GitHub webhook verification and delivery deduplication.
- idempotency and audit records for GitHub writes.
- bounded background work for repository tree construction.

It does **not** need to store generated projects.

The browser should perform ordinary ZIP generation. The backend should generate a file tree only when a GitHub operation or third-party API request requires it. Temporary generated trees must have a strict lifetime and must be removed after the request or job completes.

The MVP can run without a general database if sessions are short-lived and restart loss is acceptable. Before public API keys, refresh-token persistence, durable jobs, or multi-instance API service are enabled, add a persistent store with documented encryption, backup, migration, and retention behavior.

---

# 70. Backend Architecture

Recommended single-origin architecture:

```text
Cloudflare Tunnel
  Nginx
    /                       static application
    /assets/                immutable static assets
    /api/v1/                API upstream
    /auth/github/           GitHub authorization upstream
    /webhooks/github        webhook upstream
    /healthz                shallow Nginx health response
  mcgen-api
    generator core
    GitHub adapter
    session manager
    rate limiter
    audit logger
    bounded job executor
```

Nginx must forward `Host`, `X-Forwarded-Proto`, a normalized client address, and request correlation information. The application should use `CF-Ray` when present as upstream context while generating its own stable request ID.

The API should use structured request and response schemas. Reject unknown fields on mutating operations where practical. Apply explicit maximum sizes to JSON bodies, repository previews, generated file counts, individual files, total output bytes, path depth, and archive size.

Repository writes must be transactional at the Git reference level. Generate blobs and a tree first, create one commit, then create the target reference only after all validation succeeds. Never leave a partially populated target branch.

---

# 71. API Authentication

For public generation endpoints:

```text
No authentication
```

subject to rate limits.

Browser calls should remain same-origin. Do not enable wildcard CORS. Public server-to-server API access can use explicit versioned API keys later and does not require browser CORS.

For GitHub operations:

```text
GitHub App session
```

The browser receives only an opaque session cookie. GitHub user and installation tokens remain on the API server. Every mutating browser request requires CSRF protection and an Origin check in addition to the session.

For third-party API automation:

Possible future:

```text
MCGen API Keys
scoped third-party OAuth if a concrete client requires it
```

Never accept a caller-supplied GitHub token through the public web application. CLI users may use their local `gh` authentication without sending that credential to MCGen.

---

# 72. Rate Limiting

Prevent abuse.

Example:

```text
Anonymous generate:
browser ZIP generation remains local and does not consume server capacity

Public read API:
per-IP burst and sustained limits

Authorization endpoints:
strict per-IP and per-session limits

GitHub operations:
per-user, per-installation, per-repository, and per-IP limits
GitHub rate limit awareness
one active write job per repository target

API keys:
tiered limits
```

Use layered enforcement:

1. Cloudflare provides one broad edge rule for abusive traffic to `mcgen.enviouse.com/api/*`, excluding the GitHub webhook endpoint.
2. Nginx applies connection, request rate, body size, and timeout limits.
3. The API applies route-aware identity limits and concurrency controls.
4. The GitHub adapter stops early when GitHub reports a low remaining quota and returns a retry time.

Do not rate limit GitHub webhooks by visitor IP rules. Verify signatures, reject unsupported events, deduplicate delivery IDs, cap body size, and process accepted events through a bounded queue.

---

# 73. No Permanent Token Storage by Default

Prefer short-lived GitHub credentials.

Avoid storing:

- PATs.
- passwords.
- long-lived user tokens.
- GitHub tokens in browser storage or cookies.
- GitHub App private keys in source control, container images, logs, or deployment artifacts.

For the MVP, use expiring GitHub user access tokens and end the MCGen session when the token can no longer be used. Mint one-hour installation access tokens on demand and keep them only in process memory.

The GitHub App private key and webhook secret are required server secrets. Mount them read-only at runtime with least-privilege file permissions. Rotate them with an overlap procedure that avoids downtime. If refresh tokens are later required, encrypt them at rest with a key stored separately from the database and document deletion, rotation, and breach recovery.

---

# 74. Logging

Log only operational metadata.

Good:

```text
request ID
template
status
duration
GitHub response status
GitHub request ID
installation ID
repository numeric ID
operation type
files and bytes counts
Cloudflare Ray ID when present
```

Avoid unnecessarily logging:

```text
repository source contents
access tokens
private code
generated file contents
authorization codes
cookies
GitHub App private keys
webhook secrets or raw signed webhook bodies
```

Use structured JSON logs. Redact sensitive headers and query parameters before serialization. Audit records for GitHub writes should capture who requested the action, which installation and repository were targeted, source and target references, the resulting commit or pull request, and the final status. Retention periods must be explicit and short enough to respect privacy.

Expose private operational metrics without putting an administrative dashboard on the public application. If an operator endpoint is added, protect it separately with Cloudflare Access and do not apply Access to the public site, OAuth callback, setup callback, or webhook endpoint.

---

# 75. Security Requirements

Before public launch:

- GitHub App least privilege.
- CSRF protection.
- PKCE where supported.
- strict redirect URI handling.
- secure cookie handling.
- request validation.
- repository ownership validation.
- branch name validation.
- path traversal prevention.
- template injection prevention.
- API rate limiting.
- audit logs for GitHub writes.
- GitHub webhook HMAC-SHA256 verification over the unmodified request body.
- constant-time signature comparisons.
- webhook delivery deduplication.
- installation and repository ID authorization on every GitHub request.
- idempotency keys for branch, repository, commit, and pull-request creation.
- same-origin browser API calls with no wildcard CORS.
- Content Security Policy with `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- an intentionally scoped Permissions Policy.
- HSTS returned by the MCGen Nginx virtual host after HTTPS is verified.
- dynamic routes and generated archives marked `Cache-Control: no-store`.
- immutable caching only for content-hashed static assets.
- dependency, container image, and base image scanning.
- a documented secret rotation and incident response procedure.
- restore-tested configuration and data backups where persistent state exists.
- PNG magic-byte, decoder, dimensions, decompressed pixel count, and file-size validation on both browser and server paths.
- decode and re-encode uploaded icons by default to remove unexpected ancillary data, with an explicit Advanced preserve-original option only when policy permits it.
- strict virtual-path normalization for uploaded assets and file overrides.
- no absolute paths, parent traversal, control characters, duplicate normalized paths, case-folding collisions, device names, or symlinks in generated output.
- no server-side fetching of user-provided asset, repository, dependency, or icon URLs during generation.
- no execution of user-supplied Gradle, Maven, shell, Java, Kotlin, plugin, or task code on the production service.
- clear trust labels for canonical template content, structured customization, raw text overrides, and uploaded binary content.

Cloudflare must bypass cache for `/api/*`, `/auth/*`, and `/webhooks/*`. HTML should revalidate so a rollback or security update takes effect quickly. Content-hashed files under `/assets/` may use a one-year immutable browser cache and an appropriate Cloudflare edge cache.

The origin firewall must deny unsolicited inbound HTTP and HTTPS when Cloudflare Tunnel is used. Authenticated Origin Pulls are not required for Tunnel because the origin has no inbound listener and the connector credentials already authenticate the path.

Do not enable a challenge or Cloudflare Access policy on the GitHub webhook or callback routes. Security controls on those routes must be protocol-aware so GitHub can reach them without browser interaction.

---

# 76. Template Security

Templates must not contain:

- unknown binaries.
- suspicious Gradle plugins.
- random third-party repositories.
- unnecessary external scripts.
- curl/bash install commands.

Every dependency should be reviewable.

---

# 77. Binary Files

Avoid storing unnecessary binaries in templates.

Gradle wrapper JAR is an expected exception.

Automated checks should verify wrapper integrity where possible.

---

# 78. CI for Generator Core

Tests:

```text
unit tests
snapshot tests
integration tests
template rendering tests
path handling tests
validation tests
```

---

# 79. Snapshot Testing

For each template configuration:

```text
input configuration
      ↓
generator
      ↓
expected generated tree
```

Detect accidental output changes.

Snapshots must include more than recommended defaults. For every template, maintain representative configurations for:

```text
minimal recommended project
fully populated metadata
alpha, beta, release candidate, snapshot, and build-metadata versions
custom icon
custom repositories and dependencies
custom source sets and build properties
every supported optional feature
structured target-specific overrides
raw file replacement, addition, rename, and deletion
imported older ProjectSpec migrated to the current schema
```

---

# 80. Template Integration Testing

For each template:

1. Generate a default project.
2. Write to temporary directory.
3. Select correct JDK.
4. Run:

```bash
./gradlew build
```

5. Mark template status.

Also generate and validate a maximum structured-customization fixture. Raw arbitrary build scripts are not executed in shared template CI. Their generation, preservation, ZIP output, and GitHub tree output are tested without running them.

---

# 81. CLI Testing

Test on:

```text
Linux
Windows
macOS
```

At minimum:

- Node-supported Linux.
- Windows.
- macOS.

---

# 82. Web Testing

Browser targets:

```text
Chrome
Firefox
Edge
Safari
```

Mobile responsive testing:

```text
Android Chrome
iOS Safari
```

Test the complete customization workspace:

- Simple-to-Advanced and Advanced-to-Simple transitions without value loss.
- active advanced-override summaries, conflict handling, explicit reset, and restoration.
- raw file workspace behavior inside Advanced mode.
- field search and generated-key search.
- linked-value unlocking and resetting.
- repeatable metadata tables.
- PNG upload, preview, replacement, removal, keyboard flow, and invalid-image errors.
- structured version composer and raw versions such as `1.0.0-beta.1`.
- generated artifact filename preview.
- file tree add, rename, delete, edit, reset, and diff.
- import and export round trips.
- local draft persistence without network upload.
- dormant value preservation after platform switches.
- large forms and file trees without input lag.

---

# 83. API Documentation

Use:

```text
OpenAPI 3
```

Generate:

- API docs.
- TypeScript client.
- ProjectSpec JSON Schema and field catalog.
- multipart asset examples.
- resolved-spec, validation-report, artifact-preview, and file-tree schemas.
- stable diagnostic-code reference.
- examples for recommended, maximum structured, and raw-override configurations.
- possibly other SDKs later.

---

# 84. CLI Distribution

Possible distribution:

```bash
npm install -g @mcgen/cli
```

or:

```bash
npx @mcgen/cli
```

Potential future:

```text
Homebrew
AUR
Winget
Chocolatey
Scoop
```

---

# 85. Package Structure

Recommended monorepo:

```text
mcgen/
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── core/
│   ├── registry/
│   ├── github/
│   ├── cli/
│   ├── zip/
│   └── validation/
│
├── infrastructure/
│   ├── nginx/
│   ├── cloudflared/
│   ├── containers/
│   └── deployment/
│
├── docs/
├── scripts/
├── registry/
└── README.md
```

Production secrets, generated tunnel credentials, private keys, environment files, local deployment state, and database backups must never live under `infrastructure/`. That directory contains reviewed configuration templates, validation scripts, and secret-name contracts only.

The canonical branch-template repository is separated from the application repository from the initial bootstrap. The application consumes pinned template commits and registry revisions from `MCEnvision/MCGen-Templates`.

---

# 86. Recommended Long-Term Repository Split

Approved organization:

```text
github.com/MCEnvision/
```

Planned repositories:

```text
MCGen-Templates
MCGen
```

`MCGen-Templates` owns the canonical registry and template branches. `MCGen` will own the website, API, CLI, generator library, GitHub App integration, deployment configuration, and product documentation when that repository is created. Additional repositories require a demonstrated ownership or release boundary.

---

# 87. Naming Discussion

Possible names:

```text
MCGen
Minecraft Scaffold
BlockForge
ModInit
CraftInit
MineInit
DevCraft
Minecraft Project Generator
```

Working name in this plan:

```text
MCGen
```

Do a trademark/name-availability review before public branding.

---

# 88. Documentation

Initial docs:

```text
Getting Started
Web Generator
CLI
GitHub Integration
Existing Repository Porting
Template Registry
Creating Templates
Contributing
API
Security
Legacy Development
```

---

# 89. Contribution Guide

Contributors should be able to add a new template by:

1. Fork repository.
2. Create branch.
3. Add `.mcgen/template.json`.
4. Add minimal project.
5. Add registry entry.
6. Run validation.
7. Open PR.
8. CI builds the template.
9. Maintainer approves.

---

# 90. Template Contribution Requirements

A new template must:

- build successfully.
- use minimum necessary files.
- avoid unnecessary examples.
- declare required Java.
- declare supported languages.
- declare supported features.
- include documentation.
- pass security checks.
- pass generator substitution tests.

---

# 91. Release Strategy

Use semantic versioning for the generator:

```text
v0.1.0
v0.2.0
v1.0.0
```

Templates should have separate revisions.

Example:

```text
neoforge/1.21.1
templateRevision: 7
```

Minecraft version and template revision are different concepts.

---

# 92. Generator Schema Versioning

All template manifests, registries, exported project specifications, managed-file manifests, and override documents should include:

```json
{
  "schemaVersion": 1
}
```

When breaking manifest changes happen:

```text
schemaVersion: 2
```

Generator should retain backwards compatibility where practical.

`ProjectSpec` migrations must be explicit and pure. Parse the older document into temporary state, migrate one schema version at a time, validate the complete current model, and expose a migration report before saving. Preserve unknown namespaced extension fields unless a documented incompatible migration rejects them.

The schema revision that introduces the two-mode model must migrate older mode values without data loss:

```text
recommended -> simple
expert -> advanced
raw -> advanced, with the raw file workspace selected when the importing interface supports workspace restoration
```

All existing advanced fields and raw file operations remain unchanged during this migration. A migration must not infer that a Simple-mode document has no advanced overrides. Older raw mode is a presentation preference only after migration; `fileOperations` remain the authoritative raw changes.

Import must never overwrite the user's original configuration file. Export writes a new current-schema document. Round-trip tests must cover defaults, maximum structured customization, binary asset references, dormant platform fields, raw overrides, and every supported older schema.

---

# 93. Error Handling

Errors must be understandable.

Bad:

```text
HTTP 422
```

Good:

```text
Branch "1.21.1" already exists in EnVy/FutureShops.

Choose a different branch name or enable overwrite/update mode.
```

---

# 94. Important Error Cases

Handle:

- repository does not exist.
- no repository permission.
- branch already exists.
- source branch missing.
- invalid mod ID.
- invalid Java package.
- GitHub API rate limit.
- unsupported Minecraft/platform combination.
- unsupported Java/Kotlin selection.
- template build currently broken.
- GitHub App not installed on repository.
- user edits conflict with managed files.

---

# 95. Destructive Operation Policy

Never delete or force-push by default.

Potential destructive operations require explicit confirmation.

Examples:

```text
Overwrite existing branch
Force update branch
Delete generated files
```

Default behavior:

```text
Abort safely
```

---

# 96. Analytics

If analytics are used, keep them privacy-friendly.

Useful aggregate metrics:

```text
platform selected
minecraft version selected
ZIP vs GitHub
success/failure rate
```

Do not track user source code.

Analytics should ideally be opt-out or privacy-preserving.

---

# 97. Accessibility

Website should include:

- keyboard navigation.
- screen reader labels.
- high contrast.
- clear focus states.
- non-color status indicators.
- responsive layout.

---

# 98. MVP Definition

The MVP should prove the architecture before supporting every platform.

Recommended MVP platforms:

```text
NeoForge 1.21.1
Fabric 1.21.1
Forge 1.20.1
Paper 1.21.1
Velocity latest
```

MVP features:

```text
Web generator
ZIP export
local CLI generation
Simple and Advanced customization modes
complete schema-supported loader metadata editing
project versions including alpha, beta, release candidate, snapshot, and custom values
group ID, artifact ID, archive naming, Gradle properties, repositories, and dependencies
PNG project icon upload with preview and loader metadata wiring
generated file tree and raw text-file overrides
ProjectSpec import and export
existing repository clean branch
existing repository port branch
template registry
custom Nginx production hosting
dedicated Cloudflare Tunnel
GitHub App authorization and installation flow
GitHub Actions
Dependabot
template CI verification
```

New GitHub repository creation remains an MVP target only after the GitHub App Administration permission decision in section 27 is approved. It must not delay the safer existing-repository workflow if that decision remains open.

---

# 99. Phase 0 — Repository Foundation

Tasks:

- Decide project name.
- Create GitHub organization/repository.
- Add README.
- Add license.
- Add contributing guide.
- Add security policy.
- Define template branch convention.
- Define manifest schema.
- Define registry schema.
- Create monorepo structure.
- Configure formatting/linting/testing.
- Confirm the production origin host and deployment account.
- Confirm whether services run in containers or directly under systemd.
- Approve the GitHub App ownership and permission model.
- Reserve `mcgen.enviouse.com` without routing traffic until the origin is healthy.
- Define secret names, rotation owners, and recovery procedures without creating secrets in source control.

Deliverable:

```text
Stable repository architecture
```

---

# 100. Phase 1 — Generator Core

Build:

- template loader.
- registry parser.
- placeholder engine.
- path substitutions.
- Java package validation.
- mod/plugin ID validation.
- conditional file inclusion.
- feature flags.
- generated file-tree model.
- versioned `ProjectSpec` schema and migrations.
- immutable layered configuration resolver.
- field provenance and field-to-file impact mapping.
- structured JSON, TOML, YAML, properties, Gradle, Java, and Kotlin render targets.
- binary asset pipeline with PNG validation and deterministic output.
- project version composer and artifact naming resolver.
- metadata, dependency, repository, source-set, task, publishing, and file-override models.
- syntax-aware raw overrides and deterministic file operations.
- verification status calculation.

Tests:

- unit tests.
- snapshot tests.
- schema default, boundary, invalid input, round-trip, and migration tests.
- PNG signature, size, dimension, pixel-budget, re-encoding, and binary-integrity tests.
- property-based tests for paths, identifiers, version strings, dependency graphs, and configuration layering.

Deliverable:

```text
@mcgen/core
```

---

# 101. Phase 2 — Initial Templates

Create and verify:

```text
neoforge/1.21.1
fabric/1.21.1
forge/1.20.1
paper/1.21.1
velocity/latest-supported
```

Each must:

```bash
./gradlew build
```

successfully.

Each initial template must also declare and test its complete customization schema, metadata mappings, build capabilities, icon slot, feature conditions, raw override behavior, and maximum structured-customization fixture.

---

# 102. Phase 3 — Local CLI

Implement:

```bash
mcgen create
mcgen platforms
mcgen versions
mcgen validate
mcgen config export
mcgen config validate
```

Support:

- interactive mode.
- non-interactive flags.
- local filesystem output.
- ZIP output.
- `--config <project-spec.json>` generation.
- repeatable `--set <field>=<value>` overrides.
- `--icon <path.png>` binary asset input.
- project version and artifact options.
- structured dependency and repository options.
- raw file override directory or patch input.
- resolved-spec, validation, artifact, and generated-file previews.

Deliverable:

```text
npm package / CLI binary
```

---

# 103. Phase 4 — Web Generator

Create the Vite frontend as a host-independent static application.

Features:

- project type.
- platform.
- Minecraft version.
- dynamic options.
- validation.
- compatibility panel.
- ZIP download.
- Simple and Advanced modes with value-preserving transitions.
- schema-driven searchable configuration.
- complete loader metadata editors.
- version and artifact composer.
- PNG icon upload and preview.
- Gradle, dependency, repository, source layout, feature, publishing, and repository sections.
- live generated file tree, raw editor, and template diff.
- ProjectSpec import, export, local draft persistence, undo, and redo.
- field provenance, linked-value controls, and affected-file inspection.

No login required.

Add production-oriented behavior:

- same-origin API base paths.
- immutable content-hashed assets.
- revalidated application HTML.
- route-safe SPA fallback.
- offline-safe error states for unavailable GitHub features.
- security header compatibility tests.

The phase deliverable is a verified static bundle and Nginx configuration, not a GitHub Pages deployment.

---

# 104. Phase 5 — Production Platform

Build the minimum private API and deployment stack before registering public callbacks.

Implement:

- TypeScript API service with `/healthz` and `/readyz`.
- Nginx static serving and reverse proxy routes.
- private service networking with no public origin listener.
- production configuration validation.
- structured logging and secret redaction.
- Cloudflare header and request ID handling.
- cache-control behavior for HTML, assets, API, auth, webhooks, and archives.
- restricted atomic deployment and rollback command.
- GitHub-hosted CI packaging, checksums, source manifest, and SPDX SBOM.

After local and server health checks pass:

1. Create a dedicated `mcgen-prod` Cloudflare Tunnel.
2. Install its connector credential on the production server.
3. Route `mcgen.enviouse.com` to the private Nginx service.
4. Create the proxied CNAME record.
5. Apply hostname-scoped cache and security rules.
6. Verify the public health response and origin isolation.

Deliverable:

```text
https://mcgen.enviouse.com serves the anonymous web generator through Cloudflare and Nginx
```

---

# 105. Phase 6 — GitHub App and GitHub Adapter

Create the GitHub App only after the production callback and webhook URLs are live.

Implement:

- sign in with state and PKCE S256.
- installation and repository selection.
- permission verification.
- short-lived user and installation token handling.
- session rotation, CSRF protection, and logout.
- webhook signature verification and delivery deduplication.
- installation lifecycle handling.
- authorization and write audit records.

Implement:

- GitHub repository reads.
- source branch loading.
- Git tree creation.
- commits.
- branch creation.
- PR creation.
- repository creation.

Test the adapter first with injected test credentials against a dedicated test repository, then run end-to-end tests through the installed development GitHub App. Do not use a developer PAT in the public web service.

Repository creation is conditional on the approved Administration permission model. Existing repository operations use installation access tokens narrowed to the selected repository.

---

# 106. Phase 7 — Existing Repository Porting

Implement:

```text
clean branch
port branch
preview mode
PR mode
```

Add:

- managed file classification.
- change preview.
- conflict detection.
- safe branch creation.

This should be considered one of the major launch milestones.

Add concurrency and recovery controls:

- one active write operation per repository and target reference.
- idempotency keys for retries.
- precondition checks against the expected source commit.
- no target reference creation before the complete generated tree is ready.
- explicit handling when branch protection or repository rules reject the write.
- recovery output that identifies created blobs, trees, commits, branches, and pull requests.

---

# 107. Phase 8 — Public API

Implement:

```text
/generate
/platforms
/templates
/github/repositories
/github/branches
/github/pull-requests
```

Publish OpenAPI specification.

Add:

- explicit API key scopes.
- per-key and per-IP limits.
- idempotency headers for write endpoints.
- stable problem-detail error responses.
- request and output size budgets.
- API key creation, rotation, revocation, and audit behavior.
- a durable state store before API keys or background jobs are enabled.

---

# 108. Phase 9 — Legacy Forge

Add:

```text
forge/1.8.9
forge/1.12.2
forge/1.16.5
```

Add legacy Java/Gradle CI runners.

This phase will require more maintenance than modern versions.

---

# 109. Phase 10 — Broader Version Matrix

Expand:

```text
Forge
NeoForge
Fabric
Architectury
Paper
Spigot
Bukkit
Sponge
Velocity
BungeeCord
```

Prioritize high-use Minecraft versions.

---

# 110. Phase 11 — Automated Template Maintenance

Build release watchers.

Automatically:

- detect loader releases.
- test updates.
- create PRs.
- update registry.
- publish status.

---

# 111. Phase 12 — Advanced Integrations

Potential projects:

```text
VS Code extension
JetBrains plugin
GitHub Action
Modrinth integration
CurseForge integration
Dev Containers
Nix flake
```

---

# 112. Suggested Issue Breakdown

Initial GitHub issues:

```text
#1 Define versioned ProjectSpec schema and portable asset references
#2 Define ProjectSpec migration and unknown-extension preservation rules
#3 Define template manifest and capability schema
#4 Define compatibility registry schema
#5 Define field mappings, visibility conditions, defaults, bounds, and render targets
#6 Implement immutable layered configuration resolution and provenance
#7 Implement stable validation diagnostics and verification statuses
#8 Implement structured JSON, TOML, YAML, properties, Gradle, Java, and Kotlin renderers
#9 Implement deterministic virtual file tree and binary-safe output model
#10 Implement raw file add, replace, rename, delete, reset, and diff operations
#11 Implement PNG asset validation, transformation, digesting, and adapter pipeline
#12 Implement project version composer and artifact naming resolver
#13 Implement complete version-specific metadata domain models
#14 Implement Gradle settings, properties, toolchain, task, run, packaging, and publishing models
#15 Implement repository and dependency models with cross-linking to runtime metadata
#16 Implement source sets, entrypoints, split sources, mixins, access files, and data generation models
#17 Build generator-core package and adapter contracts
#18 Add defaults, boundaries, invalid input, round-trip, migration, property, and snapshot tests
#19 Create NeoForge 1.21.1 template and complete customization schema
#20 Create Fabric 1.21.1 template and complete customization schema
#21 Create Forge 1.20.1 template and complete customization schema
#22 Create Paper 1.21.1 template and complete customization schema
#23 Create Velocity template and complete customization schema
#24 Add recommended and maximum structured-customization fixtures for every MVP template
#25 Build CLI interactive wizard
#26 Build CLI non-interactive mode
#27 Implement local and ZIP adapters
#28 Add CLI config, set, icon, bundle, raw override, migration, and preview support
#29 Build web generator shell and section navigation
#30 Implement schema-driven Simple and Advanced form engine with preserved overrides
#31 Implement complete loader, plugin, and proxy metadata editors
#32 Implement project version and artifact preview editor
#33 Implement PNG icon upload, preview, transformation, replacement, and removal
#34 Implement Gradle and build-system editor
#35 Implement repositories and dependencies editors
#36 Implement source layout, entrypoint, run profile, and feature editors
#37 Implement publishing editor
#38 Implement generated file tree and syntax-aware raw editor
#39 Implement ProjectSpec import, export, bundle, migration, and local drafts
#40 Add field search, provenance, linking, unlock, reset, undo, and redo
#41 Add compatibility, validation, artifact, and affected-file summary panels
#42 Add browser parity, performance, accessibility, upload, and no-execution tests
#43 Build production Nginx configuration
#44 Build private API service and health checks
#45 Add atomic deployment and rollback
#46 Create dedicated Cloudflare Tunnel and DNS route
#47 Add hostname-scoped Cloudflare cache and security rules
#48 Decide GitHub App Administration permission model
#49 Register and configure GitHub App
#50 Implement GitHub authorization, state, PKCE, sessions, webhook verification, and deduplication
#51 Implement GitHub tree, commit, branch, and pull-request adapter
#52 Implement new repository creation if approved
#53 Implement porting, conflict detection, optimistic concurrency, preview, and idempotency
#54 Add public API, multipart assets, resolved specs, validation reports, and OpenAPI docs
#55 Add template CI matrix and maximum-customization build verification
#56 Add legacy Forge 1.8.9 and 1.12.2 templates
#57 Add automated template updater
#58 Add production smoke tests and origin-isolation checks
#59 Add customization security and public-service no-execution tests
#60 Add disaster recovery and secret rotation runbooks
```

---

# 113. Definition of Done for a Template

A template is complete only if:

- branch exists.
- manifest exists.
- registry entry exists.
- correct Java version documented.
- generator can customize it.
- every supported metadata and build field is declared in its configuration schema.
- every field maps to the correct version-specific files and keys.
- icon upload maps to the correct output path and metadata reference.
- recommended defaults and a maximum structured-customization fixture both generate deterministically.
- project versions such as `1.0.0-beta.1` flow consistently through Gradle, metadata, publishing, README content, and artifact naming.
- raw file overrides are preserved exactly and change verification status correctly.
- generated project builds.
- GitHub Actions build passes.
- optional features work.
- no unnecessary example content exists.
- documentation exists.
- status is marked Verified or Legacy Verified.

---

# 114. Definition of Done for MVP

MVP is ready when a user can:

### From Web

1. Select NeoForge 1.21.1.
2. Choose Simple or Advanced mode and switch between them without losing configuration.
3. Edit all schema-supported project and loader metadata.
4. Set group ID, artifact ID, package, archive naming, and a version such as `1.0.0-beta.1`.
5. Upload, preview, replace, and remove a PNG project icon.
6. Customize Gradle properties, repositories, dependencies, source layout, features, run profiles, and publishing when supported.
7. Inspect the resolved values, artifact filenames, generated tree, validation status, and template diff.
8. Add, rename, delete, or fully override generated text files.
9. Export and re-import the ProjectSpec without losing values, uploads, or raw overrides.
10. Download an exact ZIP locally without uploading the project or icon.
11. Sign in through the GitHub App using state and PKCE.
12. Select an installed GitHub account and repository.
13. Create a new branch.
14. Use an existing branch as the port base.
15. Preview generated changes.
16. Open a Pull Request.
17. Create a new GitHub repository if the Administration permission model is approved.

### From CLI

1. Generate locally.
2. Create a GitHub repository.
3. Generate into an existing repository branch.
4. Port from one branch to another.
5. Generate the same customized output from an exported ProjectSpec.
6. Supply a PNG icon and raw file overrides without web-only behavior.

### From API

1. Query templates.
2. Generate a file tree.
3. Create GitHub projects.
4. Create port branches.
5. Submit the same ProjectSpec schema and multipart binary assets.
6. Receive resolved specifications, validation reports, artifact previews, and deterministic file trees.

### From Production

1. Reach the application only at `https://mcgen.enviouse.com` through Cloudflare.
2. Confirm the origin has no public HTTP or HTTPS listener.
3. Serve the SPA and API from the same origin through Nginx.
4. Keep API, authorization, webhook, and generated archive responses out of shared caches.
5. Cache only content-hashed static assets as immutable.
6. Complete GitHub callback and webhook tests through Cloudflare without interactive challenges.
7. Deploy a verified artifact atomically and automatically roll back a failed health check.
8. Restore the prior known-good release in a documented recovery test.
9. Verify logs contain operational metadata but no tokens, authorization codes, cookies, private keys, webhook secrets, or generated source contents.
10. Verify Cloudflare, Nginx, API, and GitHub rate and concurrency controls with deterministic tests.

---

# 115. Example Final User Experience

Existing project:

```text
github.com/EnVy/FutureShops
```

Branches:

```text
main
1.20.1
```

User opens MCGen.

Selects:

```text
Mod
NeoForge
Minecraft 1.21.1
Java
Mixins
Parchment
Project version 1.0.0-beta.1
Custom PNG icon
Advanced build settings
```

Destination:

```text
Existing GitHub Repository
```

Select:

```text
EnVy/FutureShops
```

Configuration:

```text
Source Branch:
1.20.1

Target Branch:
1.21.1

Mode:
Port Existing Project

Deployment:
Create Branch + Pull Request
```

Preview:

```text
M build.gradle
M gradle.properties
M settings.gradle
M loader metadata
M project version and artifact naming

+ Dependabot
+ Build workflow
+ futureshops.png

! Custom build.gradle override retained

✓ source code preserved
✓ assets preserved
✓ data preserved
```

Click:

```text
Create Port
```

Result:

```text
FutureShops

main
1.20.1
1.21.1
```

with a PR:

```text
Port FutureShops to NeoForge 1.21.1
```

The developer can immediately begin resolving source-level Minecraft API changes.

---

# 116. Long-Term Vision

MCGen should eventually become infrastructure for the Minecraft development ecosystem rather than only a website.

The central model is:

```text
                         MCGen
                           │
                 ┌─────────┴─────────┐
                 │                   │
          Template Registry      Generator Core
                 │                   │
                 └─────────┬─────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
         Web              CLI              API
          │                │                │
          └────────────────┼────────────────┘
                           │
                   GitHub Integration
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          New Repo      New Branch       PR
```

Future clients can use the same core:

```text
VS Code
JetBrains
GitHub Actions
Third-party websites
Launchers
Custom modding tools
```

No interface should need to reimplement Minecraft template logic.

---

# 117. First Development Priority

Do **not** begin by creating dozens of Minecraft version branches.

Build the architecture first.

Recommended order:

```text
1. Versioned ProjectSpec schema, migrations, and configuration layers
2. Template manifest, registry, field mappings, and capability schemas
3. Generator core, structured renderers, file operations, validation, and asset pipeline
4. One NeoForge template with complete metadata, build, icon, and raw-override coverage
5. CLI parity for ProjectSpec, icons, overrides, validation, and previews
6. Web Simple and Advanced customization workspace, including the Advanced raw file editor, with local ZIP generation
7. Nginx and API production foundation
8. Dedicated Cloudflare Tunnel and `mcgen.enviouse.com`
9. GitHub App authorization and installation flow
10. GitHub adapter with identical ProjectSpec and asset output
11. Existing repo/branch workflow
12. Public API
13. Expand templates only after each template can satisfy the customization acceptance gate
```

The first template should prove that the same system can support:

```text
Web
CLI
API
GitHub
ProjectSpec import and export
uploaded binary assets
raw file overrides
```

without platform-specific rewrites.

---

# 118. Project Success Criteria

MCGen succeeds if:

- A beginner can create a working project in under two minutes.
- An experienced developer can scaffold a project with one CLI command.
- An existing project can receive a new Minecraft version branch safely.
- Templates are continuously build-tested.
- Legacy versions remain reproducible.
- No IDE is required.
- Generated projects remain independent of MCGen after creation.
- Developers can use the core API in their own tools.
- A beginner can stay in Simple mode while an advanced user can edit every supported metadata and build field or replace generated text files completely in Advanced mode.
- Uploaded PNG icons survive validation, preview, configuration export and import, ZIP output, local output, API output, and GitHub output without corruption.
- Project versions such as `1.0.0-beta.1` remain consistent across build files, platform metadata, publication coordinates, and artifact names unless the user explicitly unlocks a target-specific override.
- The same ProjectSpec and asset bytes produce byte-identical output across every interface.
- The public origin IP and Nginx listener are not exposed when Cloudflare Tunnel is in use.
- A failed deployment can return to the previous release without rebuilding.
- GitHub credentials never reach the browser, repository, build artifact, or logs.
- Cloudflare edge controls and application controls fail independently without blocking valid GitHub callbacks or webhooks.

---

# 119. Final Product Statement

> **MCGen is an open-source, IDE-independent Minecraft development project generator that provides verified templates for mods, plugins, and proxies across legacy and modern Minecraft versions. Developers can use recommended defaults or customize all supported metadata, icons, versions, build settings, dependencies, sources, publishing, and generated files, then generate locally, download a ZIP, create a new GitHub repository, or safely scaffold a new version branch inside an existing repository through the web, CLI, or API.**

---

# 120. Cloudflare Baseline and Provisioning Status

Verified on August 9, 2026:

```text
Zone: enviouse.com
Zone status: active
Plan: Free
SSL mode: Full strict
Always Use HTTPS: enabled
TLS 1.3: enabled with zero round trip resumption
HTTP/2: enabled
HTTP/3: enabled
Brotli: enabled
Security level: medium
Managed Free WAF ruleset: active
Layer 7 DDoS ruleset: active
mcgen.enviouse.com DNS record: absent
```

The zone-wide minimum TLS version is currently TLS 1.0. Do not change it globally as part of MCGen without checking other subdomains. Prefer a hostname-scoped Cloudflare rule requiring TLS 1.2 or newer for `mcgen.enviouse.com` if the active plan and rules engine support it. Otherwise, record the compatibility tradeoff and schedule a zone-wide migration separately.

One healthy locally managed tunnel named `ezconfig-hermes` already serves `ezconfig.enviouse.com` and `ezconfig-api.enviouse.com`. It is not an MCGen dependency and must remain unchanged. Create a dedicated `mcgen-prod` tunnel after the production server and Nginx service address are confirmed.

Cloudflare provisioning is complete only when all of these checks pass:

- the dedicated connector reports healthy.
- at least two connector processes or connections are present for normal transport resilience.
- the tunnel route ends with an explicit `http_status:404` catch-all.
- the proxied CNAME targets only the dedicated tunnel hostname.
- the public hostname presents a valid Cloudflare edge certificate.
- HTTP redirects to HTTPS.
- the external health check reaches the intended Nginx virtual host.
- a direct origin connection from the public Internet fails.
- `/assets/*` returns the intended immutable cache policy.
- `/api/*`, `/auth/*`, `/webhooks/*`, and generated archives return a bypass or no-store policy.
- GitHub callbacks and signed webhooks pass through without a browser challenge.
- Cloudflare security events and application logs share enough request context to investigate failures.

---

# 121. Nginx Production Contract

Nginx owns transport behavior between Cloudflare Tunnel and MCGen services. It does not own application authorization.

Required virtual-host behavior:

```text
server_name mcgen.enviouse.com
private listener only
unknown Host values rejected
GET and HEAD for static routes
bounded request bodies for API and webhook routes
explicit proxy connect, read, and send timeouts
WebSocket upgrade disabled unless a future feature requires it
SPA fallback only for browser routes
no SPA fallback for /api, /auth, /webhooks, or health routes
```

Caching contract:

```text
/index.html and browser routes
  Cache-Control: no-cache

/assets/<content-hash>.*
  Cache-Control: public, max-age=31536000, immutable

/api/*
/auth/*
/webhooks/*
generated ZIP responses
  Cache-Control: no-store
```

Proxy contract:

```text
preserve Host
set X-Forwarded-Proto to https
forward a normalized client address only from the trusted cloudflared network
forward CF-Ray when present
generate or forward a request ID
do not forward hop-by-hop headers
do not buffer unbounded uploads or responses
```

Nginx configuration must pass `nginx -t` in CI and on the server before activation. Add integration tests for route fallback, method restrictions, request limits, cache headers, security headers, proxy timeouts, and error responses.

---

# 122. Operational Improvements

The following improvements should be included early because they prevent expensive redesigns:

## Idempotent GitHub writes

Every repository, branch, commit, and pull-request operation should accept an idempotency key. Store the result long enough to return the original outcome after a client retry. A network timeout must not cause duplicate repositories or pull requests.

## Optimistic concurrency

Preview results must bind to the exact source commit SHA. Before writing, recheck that SHA. If the source branch moved, invalidate the preview and require regeneration.

## Bounded work

Define hard limits for repository file count, generated file count, individual file size, total bytes, archive size, path length, path depth, preview diff size, concurrent jobs, and job duration. Return a clear error before heavy work starts.

## Progressive permission disclosure

Show the GitHub App permissions beside the feature that requires them. Existing-repository generation should remain usable without repository Administration permission. Explain Workflows permission only when the selected template includes files under `.github/workflows/`.

## Staged public launch

Run the GitHub App privately on EnVisione and MCEnvision test repositories first. Verify installation changes, private repository selection, branch protection failures, revoked authorization, expired tokens, rate limits, and webhook replay behavior before making the app public.

## Failure isolation

Anonymous ZIP generation must keep working when the API, GitHub, tunnel connector, or session store is degraded. Existing generated projects must never depend on MCGen at build or runtime.

## Supply-chain evidence

Each application release should include SHA-256 and SHA-512 checksums, a source commit manifest, an SPDX SBOM, and supported artifact attestations. The deployment command must verify available evidence before activation.

---

# 123. Decisions Required Before External Provisioning

These decisions cannot be inferred safely from the Cloudflare zone or this plan:

1. **Production origin:** Identify the server that will run Nginx, the API, and `cloudflared`, plus whether the stack uses Docker Compose or host-level systemd services.
2. **Tunnel credential creation:** Approve creation of a dedicated `mcgen-prod` tunnel credential and identify the secret store or root-owned server path where its connector token will be installed.
3. **GitHub App ownership:** Choose EnVisione or a future MCGen organization as the app owner. Ownership affects app administration and transfer procedures.
4. **Repository creation permission:** Approve a primary app with Administration permission, approve a separate optional creator app, or defer web-based repository creation. The recommended choice is a separate creator app.
5. **Session durability:** Accept login loss during API restarts for the MVP, or approve a persistent encrypted session store before launch.
6. **Public API launch boundary:** Decide whether third-party API keys are part of the first public release. If they are, persistent storage, key hashing, rotation, quotas, and abuse operations move into the production-platform phase.

Until decisions 1 and 2 are answered, do not create `mcgen.enviouse.com` DNS, a tunnel credential, or public GitHub callback endpoints. This avoids creating a dead hostname or an unmanaged secret.

---

# 124. Primary References

Architecture and implementation should be checked against current primary documentation before provisioning:

- [Cloudflare Tunnel routing](https://developers.cloudflare.com/tunnel/routing/)
- [Cloudflare Tunnel security model](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Cloudflare cache rules](https://developers.cloudflare.com/cache/how-to/cache-rules/)
- [Cloudflare rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app)
- [Generating a GitHub App user access token](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)
- [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Validating GitHub webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [GitHub repository REST endpoints](https://docs.github.com/en/rest/repos/repos)
- [Fabric mod metadata](https://docs.fabricmc.net/develop/loader/fabric-mod-json)
- [NeoForge mod files](https://docs.neoforged.net/docs/gettingstarted/modfiles/)
- [Paper plugin metadata](https://docs.papermc.io/paper/dev/plugin-yml/)
- [Paper plugin model](https://docs.papermc.io/paper/dev/getting-started/paper-plugins/)
- [Gradle project properties](https://docs.gradle.org/current/userguide/project_properties.html)
- [Gradle archive naming](https://docs.gradle.org/current/userguide/working_with_files.html)

---

# 125. Total Customization Guarantee

MCGen must not limit advanced users to the fields shown by an IDE wizard or a template author's preferred defaults.

For every supported template, the user must be able to:

1. Edit every field declared by the selected platform and metadata version.
2. Edit every build value exposed by the template's structured build model.
3. Add custom metadata extension fields.
4. Add custom repositories, dependencies, properties, source sets, tasks, and publishing settings.
5. Upload a PNG project icon and other assets allowed by the template.
6. Inspect every generated file before export.
7. Replace any generated text file completely.
8. Add, rename, or delete text files in the generated tree.
9. Export the exact configuration and reproduce the same output from the web, CLI, API, or library.

Simple mode is a convenience layer. It must never be an architectural ceiling.

Total customization does not mean unsafe server execution. MCGen may generate arbitrary text, but the public production service does not run user-provided Gradle, plugin, Java, Kotlin, shell, or build logic.

---

# 126. Canonical Project Specification

Define one versioned `ProjectSpec` as the source of truth for every interface.

Conceptual structure:

```typescript
interface ProjectSpec {
  schemaVersion: number;
  template: TemplateSelection;
  mode: "simple" | "advanced";

  project: ProjectIdentity;
  platform: PlatformConfiguration;
  metadata: MetadataConfiguration;
  build: BuildConfiguration;
  dependencies: DependencyConfiguration[];
  repositories: RepositoryConfiguration[];
  sourceLayout: SourceLayoutConfiguration;
  features: FeatureConfiguration;
  assets: AssetReference[];
  publishing: PublishingConfiguration;
  repository: RepositoryOutputConfiguration;

  targetOverrides: TargetOverride[];
  fileOperations: FileOperation[];
  extensions: Record<string, unknown>;
}
```

Important rules:

- Stable field IDs are independent from labels and generated file paths.
- Platform-specific fields live under namespaced extension objects when no shared model exists.
- Defaults are resolved, not copied blindly into the saved spec.
- User intent, including an explicit empty value, is distinguishable from an unset value.
- Uploaded binary content is referenced by a content digest and provided separately by each adapter.
- Browser object URLs and local filesystem paths never appear in portable API documents.
- Secrets are forbidden in ProjectSpec and rejected during import.
- The resolved spec contains defaults and provenance for diagnostics, while the portable spec contains user intent.
- `mode` stores the preferred presentation level. Generation resolution is identical in both modes, and changing it never deletes or rewrites configuration.
- Raw editing is represented by `fileOperations`, not by a third mode value.
- Template field metadata declares Simple visibility and ordering, Advanced grouping, search aliases, compatibility rules, and affected output paths from the same schema source.

The schema package must publish JSON Schema, TypeScript types, runtime validation, field metadata, migrations, examples, and machine-readable documentation from one source.

---

# 127. Configuration Layers, Linking, and Lifecycle

Configuration resolves in this order:

```text
template defaults
compatibility-registry recommendations
imported portable ProjectSpec
current session edits
target-specific structured overrides
raw file operations
```

The resolver must parse all layers into temporary state, validate the complete result, and swap the preview atomically. A failed edit preserves the last valid preview while showing actionable errors for the pending state.

Linked values should reduce repetition without taking control away from the user. Examples:

```text
project name derives display name
mod ID derives artifact ID and resource namespace
group ID plus package suffix derives base package
project version feeds Gradle, metadata, publishing, README, and artifact names
uploaded icon path feeds loader metadata
```

Every link has an unlock control. After unlocking, the target value becomes an explicit override and does not change when its former source changes. Resetting restores the current derived value, not an obsolete original default.

When a user changes platform or Minecraft version:

- Compatible values remain active.
- Temporarily unavailable values remain dormant and visible in a migration report.
- Mappable metadata is translated through explicit rules.
- Unmappable values are preserved as extensions or raw overrides when safe.
- No custom value or uploaded asset is silently discarded.
- Generation is blocked when an unresolved conflict would create invalid output.

---

# 128. Platform Metadata Coverage

Each template version owns a metadata capability schema derived from the platform's actual format and documentation.

## Fabric

Structured coverage includes schema version, ID, version, name, description, authors, contributors, contact fields, license, icon paths or size maps, environment, entrypoints, nested JAR declarations, language adapters, mixins, access wideners or class tweakers, provided IDs, dependency classes, dependency ranges, and namespaced custom fields.

## Forge and NeoForge

Structured coverage includes file-level loader properties, license, service providers, issue and update URLs, each mod entry, display fields, logo, credits, authors, descriptions, feature requirements, display tests where supported, and complete dependency entries with version ranges, types, ordering, and logical sides. Exact fields and locations vary by Minecraft and loader version.

## Architectury and Other Multiloaders

Structured coverage includes shared identity and build values plus target-specific Fabric, Forge, and NeoForge metadata. Shared values remain linked by default. Each target can be unlocked and overridden independently. The output preview groups common and target artifacts separately.

## Bukkit and Spigot

Structured coverage includes plugin identity, version, main class, description, API version, load phase, authors, contributors, website, prefix, commands, permissions, dependencies, soft dependencies, load-before relationships, provided names, libraries, and supported custom keys.

## Paper

Support both traditional `plugin.yml` and the version-appropriate Paper plugin model. Dependency tables must represent phase, required state, ordering, and classpath behavior when supported. Do not present traditional command metadata as effective for a Paper plugin format that requires programmatic command registration.

## Sponge, Velocity, and BungeeCord

Expose every supported identity, version, entrypoint, author, description, URL, dependency, optionality, load behavior, and extension field defined by the selected template version.

The raw metadata editor is always available after structured generation. Unknown fields are retained. Unsupported fields produce warnings or errors instead of being dropped.

---

# 129. PNG Icon and Asset Pipeline

The web generator must support selecting, dragging, or pasting a PNG project icon.

Required experience:

```text
choose or drop PNG
decode and validate locally
show transparency-aware preview
show original dimensions and file size
choose preserve, contain, cover, crop, pad, or resize behavior
choose output size when the platform supports or recommends one
choose or accept the template's output path
show every metadata field that will reference the file
replace, download, reset, or remove the icon
preview the exact generated tree entry
```

Validation occurs in the browser and again in any backend GitHub or API path:

- Confirm the PNG signature and successful decoder completion.
- Reject truncated, malformed, animated, or unsupported data.
- Bound compressed bytes, dimensions, and total decoded pixels.
- Reject zero dimensions and unreasonable aspect ratios when a square icon is required.
- Normalize virtual output paths and reject collisions.
- Re-encode by default to remove unexpected ancillary metadata.
- Preserve alpha unless the user selects a background.
- Never fetch an icon URL on the server merely because it appears in the spec.

Fabric may map an icon to one path or a size-to-path dictionary. Forge and NeoForge may map a logo filename in their metadata. Plugin and proxy templates may expose icon slots only when their packaging or surrounding ecosystem supports them. The template schema owns the exact mapping.

Anonymous ZIP generation keeps uploaded bytes in browser memory. GitHub and API destinations send assets as bounded multipart parts. The library accepts bytes directly. The CLI accepts a local path and resolves it before calling the core.

The portable configuration export should offer an `.mcgen.zip` bundle containing the secret-free JSON spec and referenced assets. Import verifies every content digest before resolving the project.

---

# 130. Build System Customizer

The build editor must provide structured control over all template-supported build concerns.

## Project and Artifact Identity

```text
root project name
included projects
group ID
artifact ID
project version
archives base name
archive appendix
archive version override
archive classifier
archive extension
complete archive filename override
JAR manifest attributes
```

## Toolchain

```text
Gradle Groovy or Kotlin DSL when supported
Gradle wrapper version and distribution type
Java toolchain and release target
Kotlin plugin, language, API, and JVM target versions
loader and platform Gradle plugin versions
mappings and mapping channels
encoding, reproducibility, and compiler arguments
```

## Settings and Plugin Management

```text
pluginManagement repositories and plugins
dependencyResolutionManagement repositories and modes
version catalogs
root and included project names
feature previews supported by the pinned Gradle version
```

## Gradle Properties

Provide a typed key and value table with comments, secrecy warnings, source ownership, and ordering. Known keys receive types and validation. Unknown keys remain available. Secret-looking values are blocked from portable configuration and generated repositories unless the user handles them through documented environment or secret mechanisms.

## Source Sets and Resources

Allow platform-supported source sets, Java and Kotlin directories, resource directories, generated sources, test sources, client and server splits, common and target modules, annotation processors, resource expansion, duplicate strategies, and output directories.

## Tasks and Runs

Allow supported run profiles, JVM and program arguments, environment variables without secret values, working directories, data-generation runs, unit tests, GameTests, client and server runs, custom task registration, task configuration, dependencies, finalizers, and enabled state.

## Packaging and Publishing

Allow sources and Javadoc JARs, remap or reobfuscation configuration, shadowing where supported, included dependencies, Maven publications, repository targets, POM metadata, signing placeholders, Modrinth, CurseForge, and GitHub release configuration.

Structured controls render deterministic Groovy or Kotlin DSL. The raw file workspace in Advanced mode can replace `settings.gradle`, `settings.gradle.kts`, `build.gradle`, `build.gradle.kts`, `gradle.properties`, version catalogs, and wrapper properties completely.

---

# 131. Project Version and Artifact Naming

Project version is independent from Minecraft, loader, API, mappings, Java, Gradle, and template revision.

The version editor supports:

```text
recommended semantic version composer
free-form final value
alpha, beta, milestone, preview, release candidate, snapshot, and development channels
numeric or textual prerelease identifiers
build metadata
Minecraft or loader suffixes
target-specific versions for multiloaders
```

Examples:

```text
0.1.0-alpha.1
1.0.0-beta.2
1.0-beta
1.0.0-rc.1
1.0.0
1.0.1-SNAPSHOT
1.0.0+mc1.21.1
1.0.0-beta.1+build.42
1.21.1-1.0.0-beta
```

Do not force semantic versioning where a platform accepts a free-form value. Validate and explain what functionality is lost when a loader treats a nonconforming version as plain text and therefore cannot apply normal version-range comparison.

The UI must show live resolved values for:

```text
Gradle project version
loader metadata version
Maven coordinate
publication version
each platform target version
development run version
final JAR filenames
sources, Javadoc, shadow, remapped, and reobfuscated artifact filenames
release channel derived for publishing providers
```

Literal target-specific overrides are allowed. The summary highlights divergence so the user does not accidentally publish metadata and artifacts with different versions.

---

# 132. Repository and Dependency Editor

Repositories are ordered structured entries with type, URL, name, authentication placeholder, content filters, metadata sources, exclusive-content rules, and insecure-protocol state. Provide presets for official repositories but allow custom Maven, Ivy, flat directory, local, and platform-specific repositories when the template and Gradle version support them.

Dependencies support:

```text
configuration
group, artifact, version
version catalog alias
platform or enforced platform
classifier and extension
transitive state
changing state
capabilities
attributes
exclusions
constraints
required, recommended, suggested, incompatible, and conflict metadata links
include, shadow, jar-in-jar, runtime, compile-only, annotation processor, and loader-specific configurations
```

The editor must separate Gradle build dependencies from loader runtime metadata while allowing them to be linked. Adding a required Fabric mod dependency can optionally add both the Gradle coordinate and `depends` entry, but either side can be unlocked.

Warn about insecure HTTP repositories, unfiltered broad repositories, dynamic versions, snapshots, duplicate coordinates, contradictory loader ranges, and repositories known to shadow Maven Central content. Do not fetch arbitrary dependency artifacts during normal generation.

Local file dependencies may be represented in local and ZIP workflows. Uploaded JARs or other executable binaries require a separate explicit policy and are not part of the PNG icon upload path. MCGen never executes them.

---

# 133. Source Layout, Entrypoints, and Features

Users can customize:

```text
base package and package per source set
resource namespace
main, client, server, data-generation, bootstrap, and custom entrypoints
entrypoint class names and output paths
Java or Kotlin source language per module when supported
single-module, split-source, Architectury, and other multiloaders
test, GameTest, generated, integration-test, and tooling source sets
mixins and environment-specific mixin configurations
access transformers, access wideners, and class tweakers
data generation providers and output paths
run profiles
initial source files and optional examples
```

Cross-field validation must catch duplicate classes, invalid packages, missing source roots, entrypoints outside their source set, client classes reachable from common initialization, missing mixin or access files, resource namespace mismatch, and unsupported feature combinations.

Minimal remains the default. Total customization allows optional examples and additional scaffolding only when the user selects them.

---

# 134. Generated Tree and Raw File Editor

The final workspace must expose the complete generated tree before download or GitHub deployment.

Supported operations:

```text
open and search files
view template, structured-generated, and final content
edit a text file completely
add text files and approved binary assets
rename files and directories
delete files
reset a file or section
compare template defaults with structured output
compare structured output with raw overrides
show final deployment diff
download one file or the whole project
```

Editors should provide syntax highlighting and diagnostics for JSON, JSON5 if explicitly supported, TOML, YAML, XML, properties, Groovy, Kotlin, Java, Markdown, shell, and GitHub Actions. Formatting is opt-in for raw overrides so MCGen does not destroy deliberate comments or layout.

Raw operations apply after structured rendering. When a raw file replaces a structured target, controls affecting that file remain visible but display `overridden by raw file`. The user may discard the override to return to structured generation.

File operations use normalized relative POSIX paths internally. Adapters translate separators only at the filesystem boundary. Reject traversal, absolute paths, NULs, invalid names, case collisions, and writes under internal adapter state.

The public service does not execute or build raw content. It may statically validate supported syntax and package exact bytes.

---

# 135. Import, Export, Drafts, and Reproducibility

Support two portable exports:

```text
project.mcgen.json
  configuration only, with content digests for external assets

ProjectName.mcgen.zip
  configuration plus referenced PNG and other approved assets
```

Neither format may contain GitHub tokens, cookies, app keys, webhook secrets, publishing credentials, local absolute paths, or environment secret values.

The browser stores drafts locally by default. Drafts are keyed by a random local ID and include schema version, asset blobs, undo history bounds, and last-opened template. Users can name, duplicate, export, or delete drafts. Draft sync is future work and must be opt-in.

Deterministic generation requires:

- stable file ordering.
- stable serialization for structured files.
- normalized line endings selected by policy.
- pinned template commit or revision.
- recorded compatibility selections.
- content digests for templates, assets, and final files.
- no timestamps or random IDs in output unless the user requests them.

Given the same template revision, ProjectSpec, and asset bytes, every interface must produce byte-identical output.

---

# 136. Interface Parity

## Web

Provides the complete visual editor, icon and file previews, local drafts, import, export, and destination workflows.

## CLI

Must accept the same spec and asset bundle:

```bash
mcgen create --config project.mcgen.json --icon icon.png
mcgen create --bundle FutureShops.mcgen.zip
mcgen create --config project.mcgen.json --set build.version=1.0.0-beta.1
mcgen config validate project.mcgen.json
mcgen config migrate old-project.mcgen.json --output migrated.mcgen.json
mcgen preview --config project.mcgen.json
```

Repeatable `--set` flags are a convenience, not a second configuration model.

## API

Accept JSON-only specs or multipart specs with binary asset parts. Return the resolved spec, provenance, validation status, warnings, artifact preview, and requested output. Never interpret a client filesystem path.

## Library

Accept typed configuration plus an asset resolver interface. The core performs no filesystem, browser, GitHub, or network access. Adapters provide those effects.

All interfaces must produce the same validation messages with stable diagnostic codes.

---

# 137. Customization Safety Boundaries

Total customization is bounded by platform validity and service safety.

Generation is blocked for:

- invalid or colliding paths.
- required metadata omissions.
- impossible platform and toolchain combinations unless an Advanced raw file operation fully replaces the affected contract.
- malformed uploaded assets.
- unresolved content references.
- secret material in portable configuration.
- output beyond documented count and size budgets.

Generation is allowed with `custom-unverified` status for:

- arbitrary valid text-file replacements.
- custom Gradle plugins, tasks, repositories, and dependency coordinates.
- nonrecommended versions accepted by the target syntax.
- unknown namespaced metadata fields.
- combinations outside the tested matrix.

The public server packages this content but does not execute it, resolve dependencies, contact custom repositories, or run its build. The UI and output report must state this boundary clearly without blocking legitimate advanced use.

---

# 138. Customization Performance and Accessibility

The editor should remain responsive with large metadata tables and file trees.

Requirements:

- Incremental validation with cancellation of stale work.
- Worker-thread generation and PNG processing in the browser where useful.
- Virtualized long dependency, field, and file lists.
- Debounced previews without delaying direct text input.
- No full project regeneration for a field whose impact set is known and local.
- Keyboard access to every control, upload action, table row, mode switch, and file operation.
- Accessible error summaries linked to exact controls and raw file locations.
- Noncolor verification and diff indicators.
- Screen reader announcements for generation completion, upload errors, and validation status changes.
- Draft recovery after a tab crash where browser storage permits it.

---

# 139. Total Customization Acceptance Gate

The customization system is complete only when all of these pass for every MVP template:

1. Every supported metadata field is available in structured mode and maps to the correct file and key.
2. A user can set `1.0.0-beta.1` and see it consistently in Gradle, metadata, publishing, README content, and the final artifact name.
3. A valid PNG icon can be uploaded, previewed, transformed, exported, re-imported, and referenced correctly by loader metadata.
4. Invalid, oversized, malformed, or colliding icons fail with actionable diagnostics.
5. Group, artifact, archive, Java, Gradle, loader, mappings, API, dependency, repository, source-set, task, run, and publishing values can be customized where supported.
6. Any generated text file can be fully replaced, and new text files can be added, renamed, or deleted.
7. Raw overrides survive mode changes, save and reload, ProjectSpec export and import, ZIP generation, local generation, API generation, and GitHub tree creation.
8. The same spec and assets produce byte-identical trees in web, CLI, API, and library tests.
9. Field provenance, linked values, overrides, affected files, warnings, and final verification status are visible.
10. Simple mode remains compact enough for a beginner to generate a valid project, Advanced mode exposes every supported customization, and switching modes preserves all values and raw operations.
11. The server proves through tests that custom build logic, dependencies, repositories, and binaries are never executed.
12. Maximum structured-customization fixtures build successfully for the canonical tested matrix.
