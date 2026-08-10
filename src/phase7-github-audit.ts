import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import { repositoryRoot } from "./schema-registry.js";
import { repositoryAuditRequirementIds } from "./phase7-maintenance.js";
import { listSourceAdapters } from "./source-adapters.js";

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

function contains(content: string | undefined, marker: string): boolean {
  return typeof content === "string" && content.includes(marker);
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
        ["success", "skipped", "neutral", "cancelled"].includes(
          String(run["conclusion"]),
        ),
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

type JsonEvidence = {
  evidence: GitHubAuditEvidence;
  value?: unknown;
  valid: boolean;
};

async function localJsonEvidence(
  root: string,
  path: string,
): Promise<JsonEvidence> {
  const file = await localEvidence(root, path, "repository-file");
  if (!file.exists) return { evidence: file.evidence, valid: false };
  try {
    const value = JSON.parse(
      await readFile(resolve(root, path), "utf8"),
    ) as unknown;
    return {
      evidence: {
        ...file.evidence,
        detail: "regular JSON file was read and parsed without mutation",
      },
      value,
      valid: true,
    };
  } catch (error) {
    return {
      evidence: {
        ...file.evidence,
        detail: `regular JSON file could not be parsed, ${safeError(error)}`,
      },
      valid: false,
    };
  }
}

type DocumentRecord = {
  id: string;
  status: string;
  value: Record<string, unknown>;
  evidence: GitHubAuditEvidence;
};

type DocumentAudit = {
  documents: DocumentRecord[];
  expected: string[];
  reviewed: string[];
  blocked: string[];
  malformed: string[];
  evidence: GitHubAuditEvidence[];
};

function blockerIsExplicit(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value["reason"] === "string" &&
    value["reason"].trim().length > 0 &&
    Array.isArray(value["evidence"]) &&
    value["evidence"].length > 0
  );
}

function documentStatusFailures(
  value: Record<string, unknown>,
  expectedId: string,
): string[] {
  const failures: string[] = [];
  if (value["id"] !== expectedId) failures.push("id does not match its index");
  if (value["schemaVersion"] !== 1) failures.push("schemaVersion is not 1");
  const status = text(value["status"]);
  if (status !== "reviewed" && status !== "blocked") {
    failures.push("status is not reviewed or blocked");
  } else if (
    status === "blocked" &&
    (!Array.isArray(value["blockers"]) ||
      value["blockers"].length === 0 ||
      !value["blockers"].every(blockerIsExplicit))
  ) {
    failures.push("blocked status has no explicit blocker evidence");
  } else if (status === "reviewed" && value["blockers"] !== undefined) {
    failures.push("reviewed status still declares blockers");
  }
  return failures;
}

async function auditIndexedDocuments(
  root: string,
  indexPath: string,
  entriesKey: "profiles" | "descriptors",
): Promise<DocumentAudit> {
  const index = await localJsonEvidence(root, indexPath);
  const evidence = [index.evidence];
  const malformed: string[] = [];
  const expected: string[] = [];
  const documents: DocumentRecord[] = [];
  if (!index.valid || !isRecord(index.value)) {
    return {
      documents,
      expected,
      reviewed: [],
      blocked: [],
      malformed: ["index could not be parsed"],
      evidence,
    };
  }
  const refs = array(index.value[entriesKey]);
  if (refs.length === 0) malformed.push(`${entriesKey} index is empty`);
  for (const ref of refs) {
    if (
      !isRecord(ref) ||
      typeof ref["id"] !== "string" ||
      typeof ref["path"] !== "string"
    ) {
      malformed.push(`${entriesKey} index has an invalid reference`);
      continue;
    }
    const id = ref["id"];
    expected.push(id);
    const document = await localJsonEvidence(root, ref["path"]);
    evidence.push(document.evidence);
    if (!document.valid || !isRecord(document.value)) {
      malformed.push(`${entriesKey} ${id} could not be parsed`);
      continue;
    }
    const failures = documentStatusFailures(document.value, id);
    if (failures.length > 0)
      malformed.push(`${entriesKey} ${id}: ${failures.join(", ")}`);
    const status = text(document.value["status"]);
    documents.push({
      id,
      status,
      value: document.value,
      evidence: document.evidence,
    });
  }
  const counts = new Map<string, number>();
  for (const id of expected) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, count] of counts)
    if (count !== 1)
      malformed.push(`${entriesKey} ${id} is listed ${count} times`);
  return {
    documents,
    expected: [...new Set(expected)].sort(compareText),
    reviewed: documents
      .filter((document) => document.status === "reviewed")
      .map((document) => document.id)
      .sort(compareText),
    blocked: documents
      .filter((document) => document.status === "blocked")
      .map((document) => document.id)
      .sort(compareText),
    malformed,
    evidence,
  };
}

type CatalogAudit = {
  valid: boolean;
  detail: string;
  evidence: GitHubAuditEvidence[];
  mappingFailures: string[];
};

async function auditCatalogMappings(
  root: string,
  profiles: readonly DocumentRecord[],
): Promise<CatalogAudit> {
  const cache = new Map<string, Record<string, unknown> | undefined>();
  const evidence: GitHubAuditEvidence[] = [];
  const failures: string[] = [];
  const readCatalog = async (
    path: string,
  ): Promise<Record<string, unknown> | undefined> => {
    if (cache.has(path)) return cache.get(path);
    const document = await localJsonEvidence(root, path);
    evidence.push(document.evidence);
    const value =
      document.valid && isRecord(document.value) ? document.value : undefined;
    cache.set(path, value);
    return value;
  };
  const componentNamesByIndex = new Map<string, Set<string>>();
  const coordinatesByIndex = new Map<string, Set<string>>();
  for (const profile of profiles) {
    const catalog = profile.value["catalog"];
    if (!isRecord(catalog) || typeof catalog["indexPath"] !== "string") {
      failures.push(`profile ${profile.id} has no catalog index path`);
      continue;
    }
    const indexPath = catalog["indexPath"];
    let names = componentNamesByIndex.get(indexPath);
    let coordinates = coordinatesByIndex.get(indexPath);
    if (!names || !coordinates) {
      const index = await readCatalog(indexPath);
      const shards = array(index?.["shards"]);
      names = new Set<string>();
      coordinates = new Set<string>();
      if (!index || shards.length === 0)
        failures.push(`catalog index ${indexPath} has no shards`);
      for (const shard of shards) {
        if (!isRecord(shard) || typeof shard["path"] !== "string") {
          failures.push(
            `catalog index ${indexPath} has an invalid shard reference`,
          );
          continue;
        }
        const document = await readCatalog(shard["path"]);
        const components = array(document?.["components"]);
        if (!document || components.length === 0)
          failures.push(`catalog shard ${shard["path"]} has no components`);
        for (const component of components) {
          if (!isRecord(component)) {
            failures.push(
              `catalog shard ${shard["path"]} has a non object component`,
            );
            continue;
          }
          const id = text(component["id"]);
          const componentName = text(component["component"]);
          const coordinate = text(component["coordinate"]);
          const version = text(component["version"]);
          const status = text(component["status"]);
          const sourceEntries = array(component["sourceEntries"]);
          if (
            !id ||
            !componentName ||
            !coordinate ||
            !version ||
            !sourceEntries.length
          ) {
            failures.push(
              `catalog shard ${shard["path"]} has an incomplete component mapping`,
            );
          }
          if (!["discovered", "verified", "blocked"].includes(status)) {
            failures.push(
              `catalog component ${id || "unknown"} has an invalid status`,
            );
          }
          names.add(componentName);
          coordinates.add(coordinate);
        }
      }
      componentNamesByIndex.set(indexPath, names);
      coordinatesByIndex.set(indexPath, coordinates);
    }
    for (const selector of array(catalog["selectors"])) {
      if (!isRecord(selector)) {
        failures.push(`profile ${profile.id} has an invalid catalog selector`);
        continue;
      }
      for (const mapping of array(selector["components"])) {
        if (!isRecord(mapping)) {
          failures.push(
            `profile ${profile.id} has an invalid component mapping`,
          );
          continue;
        }
        const component = text(mapping["component"]);
        if (!component)
          failures.push(
            `profile ${profile.id} has an unnamed catalog component mapping`,
          );
        if (mapping["mode"] === "all-components") {
          if (names.size === 0)
            failures.push(
              `profile ${profile.id} maps to an empty catalog index`,
            );
          const profileComponents = array(profile.value["components"]);
          if (
            profileComponents.length === 0 ||
            profileComponents.some(
              (entry) =>
                !isRecord(entry) ||
                typeof entry["catalogComponent"] !== "string",
            )
          ) {
            failures.push(
              `profile ${profile.id} has incomplete catalog component references`,
            );
          }
        } else if (mapping["mode"] === "explicit") {
          const versions = array(mapping["versions"]).filter(
            (version): version is string => typeof version === "string",
          );
          if (versions.length === 0)
            failures.push(
              `profile ${profile.id} has an empty explicit catalog version mapping`,
            );
          for (const version of versions)
            if (!coordinates.has(version))
              failures.push(
                `profile ${profile.id} maps to missing catalog coordinate ${version}`,
              );
        } else if (mapping["mode"] !== "all-components") {
          failures.push(
            `profile ${profile.id} has an unknown catalog mapping mode`,
          );
        }
      }
    }
  }
  return {
    valid: failures.length === 0,
    detail:
      failures.length === 0
        ? `catalog component mappings are present for ${profiles.length} profiles`
        : `${failures.length} catalog component mappings are invalid`,
    evidence,
    mappingFailures: failures,
  };
}

type TupleAudit = {
  valid: boolean;
  detail: string;
  evidence: GitHubAuditEvidence[];
  failures: string[];
};

async function auditPhase5Tuples(root: string): Promise<TupleAudit> {
  const paths = [
    "verification/phase5/audit.json",
    "verification/phase5/matrix.json",
    "verification/phase5/coverage.json",
  ];
  const documents = await Promise.all(
    paths.map((path) => localJsonEvidence(root, path)),
  );
  const evidence = documents.map((document) => document.evidence);
  const failures: string[] = [];
  const audit =
    documents[0]?.valid && isRecord(documents[0].value)
      ? documents[0].value
      : undefined;
  const matrix =
    documents[1]?.valid && isRecord(documents[1].value)
      ? documents[1].value
      : undefined;
  const coverage =
    documents[2]?.valid && isRecord(documents[2].value)
      ? documents[2].value
      : undefined;
  if (!audit) failures.push("phase five audit is missing or malformed");
  if (!matrix) failures.push("phase five matrix is missing or malformed");
  if (!coverage) failures.push("phase five coverage is missing or malformed");
  if (audit) {
    const summary = isRecord(audit["evidence"]) ? audit["evidence"] : {};
    if (
      audit["status"] !== "verified" ||
      summary["unresolved"] !== 0 ||
      summary["verified"] !== summary["total"]
    ) {
      failures.push("phase five audit is not fully verified");
    }
  }
  const matrixTuples = array(matrix?.["tuples"]);
  const evidenceDirectory = resolve(root, "verification/phase5/evidence");
  let names: string[] = [];
  try {
    names = (await readdir(evidenceDirectory)).filter((name) =>
      name.endsWith(".json"),
    );
  } catch {
    failures.push("phase five evidence directory could not be read");
  }
  const records = new Map<string, Record<string, unknown>>();
  for (const name of names) {
    const document = await localJsonEvidence(
      root,
      `verification/phase5/evidence/${name}`,
    );
    evidence.push(document.evidence);
    if (document.valid && isRecord(document.value)) {
      const key = isRecord(document.value["key"])
        ? document.value["key"]
        : undefined;
      const id = text(key?.["digest"]);
      if (!id) failures.push(`phase five evidence ${name} has no tuple digest`);
      else records.set(id, document.value);
      const build = isRecord(document.value["build"])
        ? document.value["build"]
        : {};
      const artifact = isRecord(document.value["artifact"])
        ? document.value["artifact"]
        : {};
      const reproducibility = isRecord(document.value["reproducibility"])
        ? document.value["reproducibility"]
        : {};
      if (
        document.value["status"] !== "verified" ||
        build["status"] !== "passed" ||
        artifact["status"] !== "passed" ||
        reproducibility["reproducible"] !== true
      ) {
        failures.push(
          `phase five evidence ${name} is not a verified build and artifact record`,
        );
      }
    }
  }
  for (const tuple of matrixTuples) {
    if (!isRecord(tuple)) {
      failures.push("phase five matrix contains a non object tuple");
      continue;
    }
    const id = text(tuple["id"]);
    const status = text(tuple["status"]);
    const blockers = array(tuple["blockers"]);
    if (!id) {
      failures.push("phase five matrix tuple has no id");
      continue;
    }
    if (status === "verified") {
      const record = records.get(id);
      if (!record)
        failures.push(`verified tuple ${id} has no exact evidence record`);
      else if (isRecord(record["key"]) && record["key"]["digest"] !== id)
        failures.push(`tuple evidence digest does not match ${id}`);
    } else if (blockers.length === 0) {
      failures.push(`nonverified tuple ${id} has no explicit blocker mapping`);
    }
  }
  return {
    valid: failures.length === 0,
    detail:
      failures.length === 0
        ? `phase five contains exact evidence for ${records.size} tuple records`
        : `${failures.length} phase five tuple evidence mappings are incomplete`,
    evidence,
    failures,
  };
}

function allReviewed(audit: DocumentAudit, ids: readonly string[]): boolean {
  return ids.every((id) => audit.reviewed.includes(id));
}

function statusDetail(
  label: string,
  audit: DocumentAudit,
  ids: readonly string[],
): string {
  const missing = ids.filter((id) => !audit.expected.includes(id));
  const blocked = ids.filter((id) => audit.blocked.includes(id));
  const malformed = audit.malformed.filter((failure) =>
    ids.some((id) => failure.includes(` ${id}`)),
  );
  const issues = [
    ...(missing.length ? [`missing ${missing.join(", ")}`] : []),
    ...(blocked.length ? [`blocked ${blocked.join(", ")}`] : []),
    ...(malformed.length ? [`malformed ${malformed.join("; ")}`] : []),
  ];
  return issues.length
    ? `${label} status is not fully reviewed, ${issues.join("; ")}`
    : `${label} status is reviewed for ${ids.join(", ")}`;
}

function customizationFailures(audit: DocumentAudit): string[] {
  const failures: string[] = [...audit.malformed];
  for (const descriptor of audit.documents) {
    const customization = isRecord(descriptor.value["customization"])
      ? descriptor.value["customization"]
      : undefined;
    const simple = isRecord(customization?.["simple"])
      ? customization["simple"]
      : undefined;
    const advanced = isRecord(customization?.["advanced"])
      ? customization["advanced"]
      : undefined;
    if (!customization || !simple || !advanced) {
      failures.push(
        `descriptor ${descriptor.id} does not define simple and advanced customization`,
      );
      continue;
    }
    for (const mode of [simple, advanced]) {
      if (!Array.isArray(mode["fields"]) || mode["fields"].length === 0) {
        failures.push(
          `descriptor ${descriptor.id} has an empty customization field set`,
        );
      }
    }
    const rawOperations = isRecord(descriptor.value["rawOperations"])
      ? descriptor.value["rawOperations"]
      : undefined;
    if (
      !rawOperations ||
      !Array.isArray(rawOperations["allowed"]) ||
      rawOperations["allowed"].length === 0
    ) {
      failures.push(
        `descriptor ${descriptor.id} does not define advanced raw operations`,
      );
    }
    const icon = array(descriptor.value["assetSlots"]).some((slot) => {
      if (!isRecord(slot)) return false;
      return (
        slot["id"] === "icon" && array(slot["mediaTypes"]).includes("image/png")
      );
    });
    if (!icon)
      failures.push(
        `descriptor ${descriptor.id} does not expose a PNG icon slot`,
      );
  }
  return failures;
}

function versionAndAssetFailures(audit: DocumentAudit): string[] {
  const failures: string[] = [];
  for (const descriptor of audit.documents) {
    const fields = array(descriptor.value["fields"]);
    const versionField = fields.find(
      (field) => isRecord(field) && field["id"] === "project-version",
    );
    if (!isRecord(versionField) || versionField["type"] !== "version") {
      failures.push(
        `descriptor ${descriptor.id} does not define a version field`,
      );
    } else {
      const modes = array(versionField["modes"]);
      if (!modes.includes("simple") || !modes.includes("advanced")) {
        failures.push(
          `descriptor ${descriptor.id} does not expose version in both modes`,
        );
      }
    }
    const icon = array(descriptor.value["assetSlots"]).find(
      (slot) => isRecord(slot) && slot["id"] === "icon",
    );
    if (!isRecord(icon) || !array(icon["mediaTypes"]).includes("image/png")) {
      failures.push(
        `descriptor ${descriptor.id} does not define a PNG asset slot`,
      );
    }
  }
  return failures;
}

async function auditSourceDefinitions(root: string): Promise<{
  valid: boolean;
  detail: string;
  evidence: GitHubAuditEvidence[];
}> {
  const expected = listSourceAdapters()
    .map((adapter) => adapter.id)
    .sort(compareText);
  const evidence: GitHubAuditEvidence[] = [];
  const failures: string[] = [];
  for (const id of expected) {
    const definition = await localJsonEvidence(
      root,
      `sources/definitions/${id}.json`,
    );
    evidence.push(definition.evidence);
    if (!definition.valid || !isRecord(definition.value)) {
      failures.push(`source definition ${id} is missing or malformed`);
    } else {
      if (definition.value["id"] !== id)
        failures.push(`source definition ${id} has a mismatched id`);
      if (typeof definition.value["adapter"] !== "string")
        failures.push(`source definition ${id} has no adapter id`);
      if (
        !Array.isArray(definition.value["sources"]) ||
        definition.value["sources"].length === 0
      )
        failures.push(`source definition ${id} has no source resources`);
    }
    const snapshots = await localDirectoryEvidence(
      root,
      `sources/snapshots/${id}`,
    );
    evidence.push(snapshots.evidence);
    if (snapshots.count === 0)
      failures.push(`source adapter ${id} has no retained snapshots`);
  }
  return {
    valid: failures.length === 0,
    detail:
      failures.length === 0
        ? `${expected.length} source definitions and retained snapshot directories are structurally valid`
        : `${failures.length} source adapter records are incomplete`,
    evidence,
  };
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

  const profileAudit = await auditIndexedDocuments(
    root,
    "profiles/index.json",
    "profiles",
  );
  const descriptorAudit = await auditIndexedDocuments(
    root,
    "templates/index.json",
    "descriptors",
  );
  const catalogMappingAudit = await auditCatalogMappings(
    root,
    profileAudit.documents,
  );
  const tupleAudit = await auditPhase5Tuples(root);
  const sourceDefinitionAudit = await auditSourceDefinitions(root);

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
  const sourceReady = sourceDefinitionAudit.valid;
  evidence.push(
    capability(
      "source-adapters",
      sourceReady ? "passed" : "blocked",
      sourceDefinitionAudit.detail,
      [
        sourceDirectory.evidence,
        snapshotDirectory.evidence,
        ...sourceDefinitionAudit.evidence,
      ],
    ),
  );
  const catalogDirectory = await localDirectory("catalog");
  const catalogIndex = await local(
    "catalog/2026-08-10-final/index.json",
    "repository-file",
  );
  const catalogRoot = await localJsonEvidence(
    root,
    "catalog/2026-08-10-final/index.json",
  );
  const catalogRootReady =
    catalogRoot.valid &&
    isRecord(catalogRoot.value) &&
    array(catalogRoot.value["platforms"]).length >= 14 &&
    array(catalogRoot.value["sourceSnapshots"]).length >= 14 &&
    isRecord(catalogRoot.value["coverage"]) &&
    isRecord(catalogRoot.value["recommendationPolicy"]);
  const catalogReady =
    catalogDirectory.count > 0 &&
    catalogIndex.exists &&
    catalogRootReady &&
    catalogMappingAudit.valid;
  evidence.push(
    capability(
      "catalog-coverage",
      catalogReady ? "passed" : "blocked",
      catalogReady
        ? catalogMappingAudit.detail
        : `catalog content, root index, or component mappings are incomplete, ${catalogMappingAudit.detail}`,
      [
        catalogDirectory.evidence,
        catalogIndex.evidence,
        catalogRoot.evidence,
        ...catalogMappingAudit.evidence,
      ],
    ),
  );

  const profileEvidence = profileAudit.evidence;
  const descriptorEvidence = descriptorAudit.evidence;
  const forgeProfileIds = ["forge-legacy", "forge-modern"];
  const forgeDescriptorIds = ["forge"];
  const neoforgeFabricProfileIds = ["neoforge-modern", "fabric"];
  const neoforgeFabricDescriptorIds = ["neoforge", "fabric"];
  const pluginProxyProfileIds = [
    "bukkit",
    "bungeecord",
    "paper-modern",
    "paper-traditional",
    "spigot",
    "spigot-legacy",
    "spigot-modern",
    "sponge",
    "velocity",
  ];
  const pluginProxyDescriptorIds = [...pluginProxyProfileIds];
  const architecturyProfileIds = ["architectury-multiloader"];
  const architecturyDescriptorIds = ["architectury", "multiloader"];
  const documentsValid =
    profileAudit.malformed.length === 0 &&
    descriptorAudit.malformed.length === 0;
  const documentEvidence = [...profileEvidence, ...descriptorEvidence];
  const addDocumentCapability = (
    id: GitHubCapability["id"],
    profileIds: readonly string[],
    descriptorIds: readonly string[],
    label: string,
  ): void => {
    const ready =
      documentsValid &&
      allReviewed(profileAudit, profileIds) &&
      allReviewed(descriptorAudit, descriptorIds) &&
      catalogMappingAudit.valid;
    evidence.push(
      capability(
        id,
        ready ? "passed" : "blocked",
        ready
          ? `${label} profiles, descriptors, and catalog component mappings are reviewed`
          : `${statusDetail(`${label} profile`, profileAudit, profileIds)}, ${statusDetail(`${label} descriptor`, descriptorAudit, descriptorIds)}, ${catalogMappingAudit.detail}`,
        [...documentEvidence, ...catalogMappingAudit.evidence],
      ),
    );
  };
  addDocumentCapability(
    "forge-toolchain",
    forgeProfileIds,
    forgeDescriptorIds,
    "forge toolchain",
  );
  addDocumentCapability(
    "neoforge-fabric",
    neoforgeFabricProfileIds,
    neoforgeFabricDescriptorIds,
    "neoforge and fabric",
  );
  addDocumentCapability(
    "plugin-proxy-catalogs",
    pluginProxyProfileIds,
    pluginProxyDescriptorIds,
    "plugin and proxy",
  );
  addDocumentCapability(
    "architectury-multiloader",
    architecturyProfileIds,
    architecturyDescriptorIds,
    "architectury and multiloader",
  );

  const customizationIssues = customizationFailures(descriptorAudit);
  evidence.push(
    capability(
      "customization-contracts",
      customizationIssues.length === 0 ? "passed" : "blocked",
      customizationIssues.length === 0
        ? "all indexed descriptors define simple and advanced customization contracts"
        : `${customizationIssues.length} customization contract checks failed`,
      descriptorEvidence,
    ),
  );
  const versionAssetIssues = versionAndAssetFailures(descriptorAudit);
  evidence.push(
    capability(
      "asset-version-overrides",
      versionAssetIssues.length === 0 ? "passed" : "blocked",
      versionAssetIssues.length === 0
        ? "all indexed descriptors expose editable version fields and PNG asset slots"
        : `${versionAssetIssues.length} asset or version override checks failed`,
      descriptorEvidence,
    ),
  );
  evidence.push(
    capability(
      "tuple-evidence",
      tupleAudit.valid ? "passed" : "blocked",
      tupleAudit.detail,
      tupleAudit.evidence,
    ),
  );

  const semanticRequirements: readonly {
    id: GitHubCapability["id"];
    paths: readonly string[];
    valid: (contents: readonly string[]) => boolean;
  }[] = [
    {
      id: "deterministic-pack",
      paths: ["src/pack-builder.ts", "schemas/pack-manifest.schema.json"],
      valid: (contents) =>
        contains(contents[0], "buildPackManifest") &&
        contains(contents[1], '"packVersion"') &&
        contains(contents[1], '"sourceCommit"'),
    },
    {
      id: "maintenance-automation",
      paths: [
        ".github/workflows/phase7-maintenance.yml",
        "src/phase7-runner.ts",
        "src/phase7-proposal.ts",
        "schemas/maintenance-proposal.schema.json",
      ],
      valid: (contents) =>
        contents.every((content) => content.length > 0) &&
        contains(contents[0], "phase7") &&
        contains(contents[2], "ready-for-review"),
    },
    {
      id: "failure-recovery",
      paths: ["schemas/quarantine-record.schema.json", "src/phase7-monitor.ts"],
      valid: (contents) =>
        contains(contents[0], '"preserveLastKnownGood"') &&
        contains(contents[0], '"publicationBlocked"') &&
        contains(contents[1], "quarantine"),
    },
    {
      id: "tracked-file-hygiene",
      paths: [".gitignore", ".github/CODEOWNERS"],
      valid: (contents) =>
        contains(contents[0], "node_modules") && Boolean(contents[1]?.trim()),
    },
    {
      id: "documentation-wiki",
      paths: ["README.md", "docs/README.md", "docs/general/github_plan.md"],
      valid: (contents) =>
        contents.every((content) => content.trim().length > 0) &&
        contains(contents[2], "phase 7"),
    },
    {
      id: "deferred-ownership",
      paths: ["docs/general/github_plan.md", "docs/general/plan.md"],
      valid: (contents) =>
        contents.every((content) => content.trim().length > 0) &&
        contains(contents[0]?.toLocaleLowerCase("en-US"), "github app"),
    },
  ];
  for (const requirement of semanticRequirements) {
    const checks = await Promise.all(
      requirement.paths.map(async (path) => {
        const check = await local(path, "repository-file");
        let content = "";
        if (check.exists) {
          try {
            content = await readFile(resolve(root, path), "utf8");
          } catch {
            content = "";
          }
        }
        return { check, content };
      }),
    );
    const valid =
      checks.every((check) => check.check.exists) &&
      requirement.valid(checks.map((check) => check.content));
    evidence.push(
      capability(
        requirement.id,
        valid ? "passed" : "blocked",
        valid
          ? "required repository evidence was read and its expected contract was verified"
          : "required repository evidence is missing or does not implement its expected contract",
        checks.map((check) => check.check.evidence),
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
