import { describe, expect, it } from "vitest";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "../src/schema-registry.js";
import { runGitHubAudit, type GitHubApi } from "../src/phase7-github-audit.js";

function apiStub(failures: ReadonlySet<string> = new Set()): {
  api: GitHubApi;
  paths: string[];
} {
  const paths: string[] = [];
  const api: GitHubApi = async (path) => {
    await Promise.resolve();
    paths.push(path);
    if (failures.has(path)) throw new Error("permission denied");
    if (path === "/repos/MCEnvision/MCGen-Templates")
      return {
        full_name: "MCEnvision/MCGen-Templates",
        owner: "MCEnvision",
        name: "MCGen-Templates",
        default_branch: "main",
        visibility: "public",
        has_issues: true,
        has_wiki: true,
        allow_merge_commit: true,
        allow_squash_merge: false,
        allow_rebase_merge: false,
      };
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/rulesets"))
      return [{ enforcement: "active" }];
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/environments"))
      return { environments: [{ name: "testing" }, { name: "production" }] };
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/actions/workflows"))
      return { workflows: [{ name: "quality" }] };
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/actions/runs"))
      return {
        workflow_runs: [{ status: "completed", conclusion: "success" }],
      };
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/milestones"))
      return [];
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/issues"))
      return [
        {
          title:
            "automate authoritative maintenance and repository completion audits",
          state: "closed",
        },
      ];
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/releases"))
      return [{ immutable: true }];
    if (path.startsWith("/repos/MCEnvision/MCGen-Templates/topics"))
      return { names: ["minecraft"] };
    if (path.startsWith("/orgs/MCEnvision/projectsV2"))
      return [{ title: "mcgen-templates roadmap" }];
    if (path.includes("vulnerability-alerts")) return true;
    return [];
  };
  return { api, paths };
}

describe("phase 7 GitHub audit", () => {
  it("derives twenty capability results from read only API and repository evidence", async () => {
    const stub = apiStub();
    const audit = await runGitHubAudit({
      owner: "MCEnvision",
      name: "MCGen-Templates",
      generatedAt: "2026-08-10T00:00:00.000Z",
      api: stub.api,
      root: repositoryRoot,
    });
    expect(audit.capabilities).toHaveLength(20);
    expect(new Set(audit.capabilities.map((item) => item.id)).size).toBe(20);
    expect(audit.readOnly).toBe(true);
    expect(audit.mutationsAttempted).toBe(0);
    expect(stub.paths.every((path) => path.startsWith("/"))).toBe(true);
    expect(audit.capabilities.every((item) => item.evidence.length > 0)).toBe(
      true,
    );
    expect(audit.status).toBe("passed");
    const registry = await createSchemaRegistry();
    expect(validateWithSchema(registry, audit).valid).toBe(true);
  });

  it("records an unavailable capability when GitHub denies an API read", async () => {
    const rulesets =
      "/repos/MCEnvision/MCGen-Templates/rulesets?includes_parents=true&per_page=100";
    const audit = await runGitHubAudit({
      owner: "MCEnvision",
      name: "MCGen-Templates",
      generatedAt: "2026-08-10T00:00:00.000Z",
      api: apiStub(new Set([rulesets])).api,
      root: repositoryRoot,
    });
    const governance = audit.capabilities.find(
      (item) => item.id === "governance",
    );
    expect(governance?.state).toBe("blocked");
    expect(governance?.evidence.some((item) => item.path === rulesets)).toBe(
      true,
    );
  });
});
