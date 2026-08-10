import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { canonicalJson, compareText } from "./canonical-json.js";
import { sha256 } from "./digest.js";
import {
  buildMonitorRun,
  type MonitorRun,
  type MonitorSourceChange,
} from "./phase7-monitor.js";
import { reconcileSnapshots } from "./reconcile.js";
import { repositoryRoot } from "./schema-registry.js";
import {
  listSourceAdapters,
  requireSourceAdapterByAdapterId,
  type SourceAdapter,
} from "./source-adapters.js";
import { captureSourceSnapshot } from "./source-capture.js";
import type { SourceSnapshot } from "./contracts.js";

export const maintenanceRunSchema =
  "urn:mcgen:schema:maintenance-run:1" as const;

export type MaintenanceRunAdapterResult = {
  sourceFamily: string;
  adapterId: string;
  status: "captured" | "failed";
  outcome: MonitorRun["outcome"];
  classification: MonitorRun["classification"];
  monitorPath: string;
  candidatePath?: string;
  monitorRunId: string;
  error?: string;
};

export type MaintenanceRun = {
  $schema: typeof maintenanceRunSchema;
  schemaVersion: 1;
  kind: "maintenance-run";
  runId: string;
  generatedAt: string;
  baselineCatalog: { path: string; digest: string };
  candidateDirectory: string;
  adapters: MaintenanceRunAdapterResult[];
  candidateComplete: boolean;
  publicationBlocked: boolean;
  failedAdapters: string[];
};

export type MonitoringDocumentSet = {
  run: MaintenanceRun;
  monitors: { path: string; document: MonitorRun }[];
  candidates: { path: string; document: SourceSnapshot }[];
};

type CatalogIndex = {
  sourceSnapshots: { id: string; digest: string; path: string }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replaceAll(/https?:\/\/[^\s]+/gu, "[upstream]")
    .replaceAll(repositoryRoot, "[repository]")
    .replaceAll(/[\r\n]+/gu, " ")
    .slice(0, 1024);
}

function sourceSnapshotDigest(snapshot: SourceSnapshot): string {
  return sha256(canonicalJson(snapshot));
}

function sourceObservationDigest(snapshot: SourceSnapshot): string {
  const stable = structuredClone(snapshot) as unknown as {
    createdAt?: string;
    sources: Record<string, unknown>[];
  };
  delete stable.createdAt;
  for (const source of stable.sources) {
    delete source["retrievedAt"];
  }
  return sha256(canonicalJson(stable));
}

function catalogIndexDigest(index: CatalogIndex): string {
  return sha256(canonicalJson(index));
}

function requireSnapshotReference(reference: {
  id: string;
  digest: string;
  path: string;
}): void {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(reference.id))
    throw new Error("catalog source snapshot id is invalid");
  if (!/^[a-f0-9]{64}$/u.test(reference.digest))
    throw new Error(
      `catalog source snapshot digest is invalid ${reference.path}`,
    );
  const absolute = resolve(repositoryRoot, reference.path);
  const repositoryRelative = relative(repositoryRoot, absolute);
  if (
    repositoryRelative.startsWith("..") ||
    !repositoryRelative.startsWith("sources/snapshots/") ||
    !repositoryRelative.endsWith(".json")
  ) {
    throw new Error(
      `catalog source snapshot path is invalid ${reference.path}`,
    );
  }
}

function baselineByAdapter(
  index: CatalogIndex,
  snapshots: ReadonlyMap<string, SourceSnapshot>,
): Map<string, { snapshot: SourceSnapshot; path: string; digest: string }> {
  const result = new Map<
    string,
    { snapshot: SourceSnapshot; path: string; digest: string }
  >();
  for (const reference of index.sourceSnapshots) {
    requireSnapshotReference(reference);
    const snapshot = snapshots.get(reference.path);
    if (!snapshot)
      throw new Error(`catalog source snapshot is missing ${reference.path}`);
    const digest = sourceSnapshotDigest(snapshot);
    if (digest !== reference.digest) {
      throw new Error(
        `catalog source snapshot digest mismatch ${reference.path}`,
      );
    }
    const adapter = requireSourceAdapterByAdapterId(snapshot.adapter.id);
    if (result.has(adapter.id))
      throw new Error(`catalog has duplicate adapter baseline ${adapter.id}`);
    result.set(adapter.id, {
      snapshot,
      path: reference.path,
      digest: sourceObservationDigest(snapshot),
    });
  }
  return result;
}

function outcomeFor(
  baseline: SourceSnapshot,
  candidate: SourceSnapshot,
): {
  outcome?: MonitorRun["outcome"];
  added: string[];
  removed: string[];
  changed: MonitorSourceChange[];
} {
  const reconciliation = reconcileSnapshots(baseline, candidate);
  const baselineKeys = new Set(
    baseline.entries.map((entry) => entry.catalogKey),
  );
  const candidateKeys = candidate.entries
    .map((entry) => entry.catalogKey)
    .filter((key) => !baselineKeys.has(key));
  if (reconciliation.removedCoordinates.length > 0) {
    return {
      outcome: "bulk-removal",
      added: reconciliation.addedCoordinates,
      removed: reconciliation.removedCoordinates,
      changed: [],
    };
  }
  if (reconciliation.changedSources.length > 0) {
    return {
      outcome: "source-mutation",
      added: reconciliation.addedCoordinates,
      removed: [],
      changed: reconciliation.changedSources.map((source) => ({
        sourceId: source.sourceId,
        previousDigest: source.previousSha256,
        candidateDigest: source.candidateSha256,
      })),
    };
  }
  if (candidateKeys.length > 0) {
    return {
      outcome: "compatibility-boundary",
      added: reconciliation.addedCoordinates,
      removed: [],
      changed: [],
    };
  }
  const outcome =
    reconciliation.addedCoordinates.length > 0
      ? ("additions" as const)
      : undefined;
  return {
    added: reconciliation.addedCoordinates,
    removed: [],
    changed: [],
    ...(outcome ? { outcome } : {}),
  };
}

function failureOutcome(error: unknown): MonitorRun["outcome"] {
  const message = sanitizeError(error).toLocaleLowerCase("en-US");
  if (
    message.includes("empty") ||
    message.includes("malformed") ||
    message.includes("json") ||
    message.includes("xml")
  )
    return "malformed-response";
  if (
    message.includes("policy") ||
    message.includes("redirect") ||
    message.includes("media type")
  )
    return "repository-protocol-failure";
  return "source-unavailable";
}

async function loadCatalogIndex(path: string): Promise<{
  index: CatalogIndex;
  digest: string;
  snapshots: ReadonlyMap<string, SourceSnapshot>;
}> {
  const indexPath = resolve(repositoryRoot, path);
  const indexRelative = relative(repositoryRoot, indexPath);
  if (
    indexRelative.startsWith("..") ||
    !indexRelative.startsWith("catalog/") ||
    !indexRelative.endsWith(".json")
  )
    throw new Error("phase 7 baseline catalog path is invalid");
  const index = JSON.parse(await readFile(indexPath, "utf8")) as unknown;
  if (!isRecord(index) || !Array.isArray(index["sourceSnapshots"]))
    throw new Error("phase 7 baseline catalog is invalid");
  const refs = index["sourceSnapshots"].map((value) => {
    if (
      !isRecord(value) ||
      typeof value["id"] !== "string" ||
      typeof value["digest"] !== "string" ||
      typeof value["path"] !== "string"
    )
      throw new Error("phase 7 baseline catalog source reference is invalid");
    const reference = {
      id: value["id"],
      digest: value["digest"],
      path: value["path"],
    };
    requireSnapshotReference(reference);
    return reference;
  });
  const loaded = new Map<string, SourceSnapshot>();
  for (const reference of refs) {
    const rawSnapshot = JSON.parse(
      await readFile(resolve(repositoryRoot, reference.path), "utf8"),
    ) as unknown;
    if (
      !isRecord(rawSnapshot) ||
      rawSnapshot["$schema"] !== "urn:mcgen:schema:source-snapshot:1" ||
      rawSnapshot["snapshotId"] !== reference.id
    )
      throw new Error(
        `phase 7 baseline snapshot identity mismatch ${reference.path}`,
      );
    const snapshot = rawSnapshot as unknown as SourceSnapshot;
    loaded.set(reference.path, snapshot);
  }
  const normalized: CatalogIndex = { sourceSnapshots: refs };
  return {
    index: normalized,
    digest: catalogIndexDigest(normalized),
    snapshots: loaded,
  };
}

export async function runSourceMonitoring(input: {
  baselineCatalogPath: string;
  candidateDirectory: string;
  monitorDirectory: string;
  generatedAt: string;
  capture?: (
    adapter: SourceAdapter,
    createdAt: string,
  ) => Promise<SourceSnapshot>;
}): Promise<MonitoringDocumentSet> {
  const baselineCatalog = await loadCatalogIndex(input.baselineCatalogPath);
  const baselines = baselineByAdapter(
    baselineCatalog.index,
    baselineCatalog.snapshots,
  );
  const adapters = [...listSourceAdapters()].sort((left, right) =>
    compareText(left.id, right.id),
  );
  if (baselines.size !== adapters.length)
    throw new Error(
      "baseline catalog does not cover every registered source adapter",
    );
  const documents: MonitoringDocumentSet["monitors"] = [];
  const candidates: MonitoringDocumentSet["candidates"] = [];
  const results: MaintenanceRunAdapterResult[] = [];
  for (const adapter of adapters) {
    const baseline = baselines.get(adapter.id);
    if (!baseline)
      throw new Error(`baseline catalog has no adapter ${adapter.id}`);
    const monitorPath = `${input.monitorDirectory}/${adapter.id}.json`;
    try {
      const candidate = await (input.capture
        ? input.capture(adapter, input.generatedAt)
        : captureSourceSnapshot(adapter.id, input.generatedAt).then(
            (result) => result.snapshot,
          ));
      const candidatePath = `${input.candidateDirectory}/${adapter.id}.json`;
      const digest = sourceObservationDigest(candidate);
      const delta = outcomeFor(baseline.snapshot, candidate);
      const monitor = buildMonitorRun({
        sourceFamily: adapter.id,
        adapterId: adapter.adapterId,
        generatedAt: input.generatedAt,
        baseline: {
          id: baseline.snapshot.snapshotId,
          digest: baseline.digest,
          path: baseline.path,
        },
        candidate: { id: candidate.snapshotId, digest, path: candidatePath },
        addedCoordinates: delta.added,
        removedCoordinates: delta.removed,
        changedSources: delta.changed,
        ...(delta.outcome ? { outcome: delta.outcome } : {}),
      });
      if (monitor.classification !== "no-change") {
        candidates.push({ path: candidatePath, document: candidate });
      }
      documents.push({ path: monitorPath, document: monitor });
      results.push({
        sourceFamily: adapter.id,
        adapterId: adapter.adapterId,
        status: "captured",
        outcome: monitor.outcome,
        classification: monitor.classification,
        monitorPath,
        ...(monitor.classification !== "no-change" ? { candidatePath } : {}),
        monitorRunId: monitor.runId,
      });
    } catch (error) {
      const monitor = buildMonitorRun({
        sourceFamily: adapter.id,
        adapterId: adapter.adapterId,
        generatedAt: input.generatedAt,
        baseline: {
          id: baseline.snapshot.snapshotId,
          digest: baseline.digest,
          path: baseline.path,
        },
        candidate: null,
        outcome: failureOutcome(error),
        reasons: [sanitizeError(error)],
      });
      documents.push({ path: monitorPath, document: monitor });
      results.push({
        sourceFamily: adapter.id,
        adapterId: adapter.adapterId,
        status: "failed",
        outcome: monitor.outcome,
        classification: monitor.classification,
        monitorPath,
        monitorRunId: monitor.runId,
        error: sanitizeError(error),
      });
    }
  }
  const failedAdapters = results
    .filter((result) => result.status === "failed")
    .map((result) => result.sourceFamily)
    .sort(compareText);
  const candidateComplete = failedAdapters.length === 0;
  const publicationBlocked = results.some(
    (result) => result.classification !== "no-change",
  );
  const withoutId = {
    $schema: maintenanceRunSchema,
    schemaVersion: 1 as const,
    kind: "maintenance-run" as const,
    generatedAt: input.generatedAt,
    baselineCatalog: {
      path: input.baselineCatalogPath,
      digest: baselineCatalog.digest,
    },
    candidateDirectory: input.candidateDirectory,
    adapters: results.sort((left, right) =>
      compareText(left.sourceFamily, right.sourceFamily),
    ),
    candidateComplete,
    publicationBlocked,
    failedAdapters,
  };
  const identity = { ...withoutId };
  delete (identity as { generatedAt?: string }).generatedAt;
  return {
    run: { ...withoutId, runId: sha256(canonicalJson(identity)) },
    monitors: documents,
    candidates,
  };
}
