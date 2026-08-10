import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import { repositoryRoot } from "./schema-registry.js";
import { repositoryAuditRequirementIds } from "./phase7-maintenance.js";

export const githubAuditSchema = "urn:mcgen:schema:github-audit:1" as const;

export type GitHubApi = (path: string) => Promise<unknown>;

export type GitHubAuditEvidence = {
  kind: "github-api" | "repository-file" | "repository-directory";
  path: string;
  url?: string;
  digest?: string;
  detail: string;
};

export type GitHubCapabilityState =
  "passed" | "blocked" | "unavailable" | "failed";

export type GitHubCapability = {
  id: (typeof repositoryAuditRequirementIds)[number];
  state: GitHubCapabilityState;
  detail: string;
  evidence: GitHubAuditEvidence[];
};

export type GitHubAudit = {
  $schema: typeof githubAuditSchema;
  schemaVersion: 1;
  kind: "github-audit";
  auditId: string;
  generatedAt: string;
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
    visibility: "public" | "private" | "internal";
  };
  readOnly: true;
  mutationsAttempted: 0;
  status: "passed" | "blocked";
  capabilities: GitHubCapability[];
  blockers: string[];
};

type ApiObservation = {
  path: string;
  value?: unknown;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(/[\r\n]+/gu, " ").slice(0, 512);
}

function apiUrl(path: string): string {
  return `https://api.github.com${path}`;
}

function apiEvidence(observation: ApiObservation): GitHubAuditEvidence {
  return {
    kind: "github-api",
    path: observation.path,
    url: apiUrl(observation.path),
    detail: observation.error
      ? `read failed, ${observation.error}`
      : "read completed successfully",
  };
}

async function readApi(api: GitHubApi, path: string): Promise<ApiObservation> {
  try {
    return { path, value: await api(path) };
  } catch (error) {
    return { path, error: safeError(error) };
  }
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasActiveRuleset(value: unknown): boolean {
  return array(value).some(
    (item) =>
      isRecord(item) &&
      (item["enforcement"] === "active" || item["enforcement"] === "enabled"),
  );
}

function hasEnvironment(value: unknown, name: string): boolean {
  return array(isRecord(value) ? value["environments"] : undefined).some(
    (item) => isRecord(item) && item["name"] === name,
  );
}

function hasNoOpenAlerts(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(
    (alert) =>
      isRecord(alert) &&
      !["open", "active"].includes(
        text(alert["state"]).toLocaleLowerCase("en-US"),
      ),
  );
}

function hasHealthyRuns(value: unknown): boolean {
  const runs = array(isRecord(value) ? value["workflow_runs"] : undefined);
  return (
    runs.length > 0 &&
    runs.every(
      (run) =>
        isRecord(run) &&
        run["status"] === "completed" &&
        ["success", "skipped", "neutral"].includes(String(run["conclusion"])),
    )
  );
}

function hasRoadmapProject(value: unknown): boolean {
  return array(value).some(
    (project) =>
      isRecord(project) &&
      text(project["title"]).toLocaleLowerCase("en-US") ===
        "mcgen-templates roadmap",
  );
}

function hasClosedPhaseIssue(value: unknown): boolean {
  return array(value).some(
    (issue) =>
      isRecord(issue) &&
      text(issue["title"])
        .toLocaleLowerCase("en-US")
        .includes("automate authoritative maintenance") &&
      issue["state"] === "closed",
  );
}

async function localEvidence(
  root: string,
  path: string,
  kind: "repository-file" | "repository-directory",
): Promise<{ evidence: GitHubAuditEvidence; exists: boolean }> {
  const absolute = resolve(root, path);
  try {
    const metadata = await stat(absolute);
    if (kind === "repository-file" && !metadata.isFile()) {
      return {
        exists: false,
        evidence: {
          kind,
          path,
          detail: "path exists but is not a regular file",
        },
      };
    }
    if (kind === "repository-directory" && !metadata.isDirectory()) {
      return {
        exists: false,
        evidence: { kind, path, detail: "path exists but is not a directory" },
      };
    }
    let digest: string | undefined;
    if (metadata.isFile()) digest = sha256(await readFile(absolute));
    return {
      exists: true,
      evidence: {
        kind,
        path,
        ...(digest ? { digest } : {}),
        detail: "path exists and was read without mutation",
      },
    };
  } catch (error) {
    const code =
      isRecord(error) && typeof error["code"] === "string"
        ? error["code"]
        : "unavailable";
    return {
      exists: false,
      evidence: { kind, path, detail: `path could not be read, ${code}` },
    };
  }
}

async function localDirectoryEvidence(
  root: string,
  path: string,
): Promise<{ evidence: GitHubAuditEvidence; count: number }> {
  const absolute = resolve(root, path);
  try {
    const names = (await readdir(absolute)).sort(compareText);
    return {
      count: names.length,
      evidence: {
        kind: "repository-directory",
        path,
        digest: sha256(canonicalJson(names)),
        detail: `directory contains ${names.length} entries`,
      },
    };
  } catch (error) {
    return {
      count: 0,
      evidence: {
        kind: "repository-directory",
        path,
        detail: `directory could not be read, ${safeError(error)}`,
      },
    };
  }
}

function capability(
  id: GitHubCapability["id"],
  state: GitHubCapabilityState,
  detail: string,
  evidence: GitHubAuditEvidence[],
): GitHubCapability {
  return { id, state, detail, evidence };
}

export async function runGitHubAudit(input: {
  owner: string;
  name: string;
  generatedAt: string;
  api: GitHubApi;
  root?: string;
}): Promise<GitHubAudit> {
  const root = input.root ?? repositoryRoot;
  const prefix = `/repos/${input.owner}/${input.name}`;
  const paths = {
    repository: prefix,
    rulesets: `${prefix}/rulesets?includes_parents=true&per_page=100`,
    environments: `${prefix}/environments?per_page=100`,
    workflows: `${prefix}/actions/workflows?per_page=100`,
    runs: `${prefix}/actions/runs?per_page=10`,
    milestones: `${prefix}/milestones?state=all&per_page=100`,
    releases: `${prefix}/releases?per_page=10`,
    topics: `${prefix}/topics`,
    phaseIssues: `${prefix}/issues?state=all&milestone=2&per_page=100`,
    dependabot: `${prefix}/dependabot/alerts?per_page=1`,
    codeScanning: `${prefix}/code-scanning/alerts?per_page=1`,
    secretScanning: `${prefix}/secret-scanning/alerts?per_page=1`,
    vulnerabilityAlerts: `${prefix}/vulnerability-alerts`,
    projects: `/orgs/${input.owner}/projectsV2?per_page=100`,
  } as const;
  const observations = new Map<string, ApiObservation>();
  await Promise.all(
    Object.entries(paths).map(async ([key, path]) => {
      observations.set(key, await readApi(input.api, path));
    }),
  );
  const get = (key: keyof typeof paths): ApiObservation => {
    const observation = observations.get(key);
    if (!observation) throw new Error(`missing GitHub observation ${key}`);
    return observation;
  };
  const repository = get("repository");
  const repositoryValue = isRecord(repository.value) ? repository.value : {};
  const owner = text(repositoryValue["owner"]) || input.owner;
  const name = text(repositoryValue["name"]) || input.name;
  const defaultBranch = text(repositoryValue["default_branch"]) || "unknown";
  const rawVisibility = text(repositoryValue["visibility"]);
  const visibility: GitHubAudit["repository"]["visibility"] =
    rawVisibility === "private" || rawVisibility === "internal"
      ? rawVisibility
      : "public";
  const evidence: GitHubCapability[] = [];
  const local = async (
    path: string,
    kind: "repository-file" | "repository-directory",
  ): Promise<{ evidence: GitHubAuditEvidence; exists: boolean }> =>
    localEvidence(root, path, kind);
  const localDirectory = async (
    path: string,
  ): Promise<{ evidence: GitHubAuditEvidence; count: number }> =>
    localDirectoryEvidence(root, path);

  const rulesets = get("rulesets");
  const topics = get("topics");
  const repoReady =
    !repository.error &&
    text(repositoryValue["full_name"]).toLocaleLowerCase("en-US") ===
      `${input.owner}/${input.name}`.toLocaleLowerCase("en-US") &&
    defaultBranch === "main" &&
    repositoryValue["has_issues"] === true &&
    repositoryValue["has_wiki"] === true &&
    repositoryValue["allow_merge_commit"] === true &&
    repositoryValue["allow_squash_merge"] === false &&
    repositoryValue["allow_rebase_merge"] === false;
  evidence.push(
    capability(
      "governance",
      repoReady && hasActiveRuleset(rulesets.value) ? "passed" : "blocked",
      repoReady && hasActiveRuleset(rulesets.value)
        ? "repository identity and active main ruleset match policy"
        : "repository identity or active main ruleset does not match policy",
      [apiEvidence(repository), apiEvidence(rulesets), apiEvidence(topics)],
    ),
  );

  const workflows = get("workflows");
  const runs = get("runs");
  const workflowReady =
    !workflows.error &&
    array(
      workflows.value && isRecord(workflows.value)
        ? workflows.value["workflows"]
        : undefined,
    ).length > 0;
  const runsReady = !runs.error && hasHealthyRuns(runs.value);
  evidence.push(
    capability(
      "required-checks",
      workflowReady && runsReady ? "passed" : "blocked",
      workflowReady && runsReady
        ? "workflow inventory and recent runs are healthy"
        : "workflow inventory or recent runs are unavailable or failing",
      [apiEvidence(workflows), apiEvidence(runs)],
    ),
  );

  const environments = get("environments");
  const dependabot = get("dependabot");
  const codeScanning = get("codeScanning");
  const secretScanning = get("secretScanning");
  const vulnerabilityAlerts = get("vulnerabilityAlerts");
  const securityReady =
    !environments.error &&
    hasEnvironment(environments.value, "testing") &&
    hasEnvironment(environments.value, "production") &&
    hasNoOpenAlerts(dependabot.value) &&
    hasNoOpenAlerts(codeScanning.value) &&
    hasNoOpenAlerts(secretScanning.value) &&
    (vulnerabilityAlerts.value === true ||
      (isRecord(vulnerabilityAlerts.value) &&
        vulnerabilityAlerts.value["enabled"] === true));
  evidence.push(
    capability(
      "security-controls",
      securityReady ? "passed" : "blocked",
      securityReady
        ? "protected environments and security alert controls are healthy"
        : "protected environments or security alert controls are incomplete",
      [
        apiEvidence(environments),
        apiEvidence(secretScanning),
        apiEvidence(codeScanning),
        apiEvidence(dependabot),
        apiEvidence(vulnerabilityAlerts),
      ],
    ),
  );

  const milestones = get("milestones");
  const projects = get("projects");
  const planningReady =
    !milestones.error && !projects.error && hasRoadmapProject(projects.value);
  evidence.push(
    capability(
      "planning",
      planningReady ? "passed" : "blocked",
      planningReady
        ? "milestones and the linked roadmap project are readable"
        : "milestones or the linked roadmap project are unavailable",
      [apiEvidence(milestones), apiEvidence(projects)],
    ),
  );

  const sourceDirectory = await localDirectory("sources/definitions");
  const snapshotDirectory = await localDirectory("sources/snapshots");
  const sourceReady =
    sourceDirectory.count >= 14 && snapshotDirectory.count >= 14;
  evidence.push(
    capability(
      "source-adapters",
      sourceReady ? "passed" : "blocked",
      sourceReady
        ? `fourteen source definitions and ${snapshotDirectory.count} snapshots are present`
        : "the complete source definition or snapshot set is missing",
      [sourceDirectory.evidence, snapshotDirectory.evidence],
    ),
  );
  const catalogDirectory = await localDirectory("catalog");
  const catalogIndex = await local(
    "catalog/2026-08-10-r4/index.json",
    "repository-file",
  );
  evidence.push(
    capability(
      "catalog-coverage",
      catalogDirectory.count > 0 && catalogIndex.exists ? "passed" : "blocked",
      catalogDirectory.count > 0 && catalogIndex.exists
        ? "catalog content and its immutable root index are present"
        : "catalog content or its immutable root index is missing",
      [catalogDirectory.evidence, catalogIndex.evidence],
    ),
  );

  const localRequirements: readonly {
    id: GitHubCapability["id"];
    paths: readonly string[];
  }[] = [
    { id: "forge-toolchain", paths: ["profiles", "sources/definitions"] },
    { id: "neoforge-fabric", paths: ["profiles", "sources/definitions"] },
    { id: "plugin-proxy-catalogs", paths: ["profiles", "sources/definitions"] },
    { id: "architectury-multiloader", paths: ["profiles", "templates"] },
    { id: "customization-contracts", paths: ["schemas", "templates"] },
    { id: "asset-version-overrides", paths: ["schemas", "fixtures"] },
    {
      id: "tuple-evidence",
      paths: [
        "verification/phase5/evidence",
        "verification/phase5/matrix.json",
      ],
    },
    {
      id: "deterministic-pack",
      paths: ["src/pack-builder.ts", "schemas/pack-manifest.schema.json"],
    },
    {
      id: "maintenance-automation",
      paths: [
        ".github/workflows/phase7-maintenance.yml",
        "src/phase7-runner.ts",
        "src/phase7-proposal.ts",
        "schemas/maintenance-proposal.schema.json",
      ],
    },
    {
      id: "failure-recovery",
      paths: ["schemas/quarantine-record.schema.json", "src/phase7-monitor.ts"],
    },
    { id: "tracked-file-hygiene", paths: [".gitignore", ".github/CODEOWNERS"] },
    {
      id: "documentation-wiki",
      paths: ["README.md", "docs/README.md", "docs/general/github_plan.md"],
    },
    {
      id: "deferred-ownership",
      paths: ["docs/general/github_plan.md", "docs/general/plan.md"],
    },
  ];
  for (const requirement of localRequirements) {
    const checks = await Promise.all(
      requirement.paths.map((path) =>
        local(
          path,
          path.includes(".") && !path.endsWith("/")
            ? "repository-file"
            : "repository-directory",
        ),
      ),
    );
    const exists = checks.every((check) => check.exists);
    let state: GitHubCapabilityState = exists ? "passed" : "blocked";
    let detail = exists
      ? "required repository evidence is present"
      : "required repository evidence is incomplete";
    if (requirement.id === "tuple-evidence" && exists) {
      try {
        const audit = JSON.parse(
          await readFile(
            resolve(root, "verification/phase5/audit.json"),
            "utf8",
          ),
        ) as Record<string, unknown>;
        const summary = isRecord(audit["evidence"]) ? audit["evidence"] : {};
        if (
          audit["status"] !== "verified" ||
          summary["unresolved"] !== 0 ||
          summary["verified"] !== summary["total"]
        ) {
          state = "blocked";
          detail =
            "phase five evidence audit contains unresolved or unverified records";
        }
      } catch {
        state = "blocked";
        detail = "phase five evidence audit could not be read";
      }
    }
    evidence.push(
      capability(
        requirement.id,
        state,
        detail,
        checks.map((check) => check.evidence),
      ),
    );
  }

  const phaseIssues = get("phaseIssues");
  const maintenance = evidence.find(
    (item) => item.id === "maintenance-automation",
  );
  if (maintenance) {
    const workflowReady = maintenance.state === "passed";
    const phaseIssueReady =
      !phaseIssues.error && hasClosedPhaseIssue(phaseIssues.value);
    maintenance.state = workflowReady && phaseIssueReady ? "passed" : "blocked";
    maintenance.detail =
      workflowReady && phaseIssueReady
        ? "maintenance workflow evidence is present and phase seven issue is closed"
        : "maintenance workflow exists but phase seven completion issue remains open or unavailable";
    maintenance.evidence.push(apiEvidence(phaseIssues));
  }

  const releases = get("releases");
  const immutableRelease = array(releases.value).some(
    (release) => isRecord(release) && release["immutable"] === true,
  );
  evidence.push(
    capability(
      "immutable-release",
      immutableRelease ? "passed" : "blocked",
      immutableRelease
        ? "an immutable release is visible"
        : "no immutable release is visible",
      [apiEvidence(releases)],
    ),
  );

  const blockers = evidence
    .filter((item) => item.state !== "passed")
    .map((item) => `${item.id}: ${item.detail}`)
    .sort(compareText);
  const withoutId = {
    $schema: githubAuditSchema,
    schemaVersion: 1 as const,
    kind: "github-audit" as const,
    generatedAt: input.generatedAt,
    repository: { owner, name, defaultBranch, visibility },
    readOnly: true as const,
    mutationsAttempted: 0 as const,
    status: blockers.length ? ("blocked" as const) : ("passed" as const),
    capabilities: evidence,
    blockers,
  };
  return { ...withoutId, auditId: sha256(canonicalJson(withoutId)) };
}
