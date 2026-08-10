import type {
  SnapshotEntry,
  SourceSnapshot,
  StabilityChannel,
  SnapshotCompatibility,
} from "../contracts.js";

export type CatalogCategory =
  "mod" | "plugin" | "proxy" | "multiloader" | "toolchain";

export type CatalogKeyKind = "minecraft" | "api" | "global" | "unresolved";

export type CatalogStatus =
  | "discovered"
  | "resolvable"
  | "verified"
  | "legacy-verified"
  | "experimental"
  | "blocked"
  | "withdrawn"
  | "broken"
  | "deprecated"
  | "custom-unverified";

export type CatalogConfidence =
  "published" | "documented" | "verified" | "inferred";

export type SnapshotInput = {
  path: string;
  snapshot: SourceSnapshot;
};

export type SnapshotReference = {
  id: string;
  digest: string;
  path: string;
};

export type SourceEntryReference = {
  snapshotId: string;
  entryIndex: number;
  sourceIndexes: number[];
};

export type CatalogComponent = {
  id: string;
  component: string;
  version: string;
  coordinate: string;
  channel: StabilityChannel;
  compatibility?: SnapshotCompatibility;
  status: CatalogStatus;
  sourceEntries: SourceEntryReference[];
};

export type CatalogEdge = {
  kind:
    | "targets"
    | "requires"
    | "supports"
    | "conflicts-with"
    | "replaces"
    | "deprecated-by";
  from: string;
  to: string;
  confidence: CatalogConfidence;
  sourceEntries: SourceEntryReference[];
};

export type CatalogBlocker = {
  id: string;
  subject: string;
  reason: string;
  evidence: string[];
  rejectedEntries?: RejectedEntryReference[];
};

export type RejectedEntryReference = {
  snapshotId: string;
  rejectedIndex: number;
  sourceIndex: number;
};

export type CatalogShard = {
  $schema: "urn:mcgen:schema:catalog:1";
  schemaVersion: 1;
  id: string;
  catalogId: string;
  platform: string;
  category: CatalogCategory;
  keyKind: CatalogKeyKind;
  key: string;
  sourceSnapshots: string[];
  components: CatalogComponent[];
  edges: CatalogEdge[];
  blockers: CatalogBlocker[];
};

export type CatalogShardReference = {
  key: string;
  id: string;
  path: string;
  sha256: string;
  bytes: number;
  sourceSnapshots: string[];
};

export type CatalogPlatformIndex = {
  $schema: "urn:mcgen:schema:catalog-platform-index:1";
  schemaVersion: 1;
  id: string;
  catalogId: string;
  platform: string;
  shards: CatalogShardReference[];
};

export type CatalogCoverageEntry = {
  snapshotId: string;
  entryIndex: number;
  disposition: "represented" | "blocked";
  shardId: string;
  blockerId?: string;
};

export type CoveragePlatform = {
  platform: string;
  discovered: number;
  represented: number;
  rejected: number;
  statuses: Record<string, number>;
  entries: CatalogCoverageEntry[];
  blockers: CatalogBlocker[];
  unexplainedGaps: string[];
};

export type CoverageReport = {
  $schema: "urn:mcgen:schema:coverage-report:1";
  schemaVersion: 1;
  rejectionAccountingVersion: 1;
  catalogId: string;
  sourceSnapshots: (SnapshotReference & {
    entries: number;
    rejected: number;
  })[];
  platforms: CoveragePlatform[];
};

export type RecommendationPolicy = {
  $schema: "urn:mcgen:schema:catalog-recommendation-policy:1";
  schemaVersion: 1;
  id: string;
  version: "1.0.0";
  eligibleStatuses: ["verified", "legacy-verified"];
  eligibleChannels: ["release"];
  tieBreakOrder: [
    "official-marker",
    "status",
    "nondeprecated",
    "version",
    "evidence",
    "text",
  ];
  fallback: "none";
};

export type CatalogIndex = {
  $schema: "urn:mcgen:schema:catalog-index:1";
  schemaVersion: 1;
  id: string;
  sourceSnapshots: SnapshotReference[];
  recommendationPolicy: { path: string; sha256: string };
  platforms: { platform: string; path: string; sha256: string }[];
  coverage: { path: string; sha256: string };
};

export type CatalogBuildInput = {
  snapshots: SnapshotInput[];
  categoryByPlatform: Readonly<Record<string, CatalogCategory>>;
  keyKindByPlatform: Readonly<Record<string, CatalogKeyKind>>;
  outputRoot?: string;
};

export type CatalogBuildResult = {
  index: CatalogIndex;
  policy: RecommendationPolicy;
  platformIndexes: CatalogPlatformIndex[];
  shards: { path: string; document: CatalogShard }[];
  coverage: CoverageReport;
};

export type CatalogDriftReport = {
  $schema: "urn:mcgen:schema:catalog-drift-report:1";
  schemaVersion: 1;
  baseline: Pick<SnapshotReference, "id" | "digest">[];
  candidate: Pick<SnapshotReference, "id" | "digest">[];
  added: string[];
  retained: string[];
  removed: string[];
  changedSources: {
    sourceId: string;
    previousDigest: string;
    candidateDigest: string;
  }[];
  requiresReview: boolean;
};

export type IndexedSnapshotEntry = {
  snapshot: SnapshotInput;
  entry: SnapshotEntry;
  entryIndex: number;
};
