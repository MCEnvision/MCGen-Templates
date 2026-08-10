export const sourceSnapshotSchema =
  "urn:mcgen:schema:source-snapshot:1" as const;

export type StabilityChannel =
  "release" | "release-candidate" | "beta" | "alpha" | "snapshot" | "custom";

export type SourceRecord = {
  sourceId?: string;
  role?: SourceResourceRole;
  requestedUrl?: string;
  url: string;
  redirectChain?: string[];
  retrievedAt: string;
  contentType: string;
  etag?: string;
  lastModified?: string;
  sha256: string;
  bytes: number;
};

export type SnapshotEntry = {
  platform: string;
  component: string;
  catalogKey: string;
  version: string;
  coordinate: string;
  channel: StabilityChannel;
  sourceIndexes: number[];
};

export type RejectedEntry = {
  value: string;
  reason: string;
  sourceIndex: number;
};

export type SourceSnapshot = {
  $schema: typeof sourceSnapshotSchema;
  schemaVersion: 1;
  provenanceVersion?: 1;
  snapshotId: string;
  adapter: {
    id: string;
    version: string;
  };
  createdAt: string;
  sources: SourceRecord[];
  entries: SnapshotEntry[];
  rejected: RejectedEntry[];
  warnings: string[];
};

export type FetchedResource = {
  record: SourceRecord;
  text: string;
};

export type SourceDefinition = {
  $schema: "urn:mcgen:schema:source-definition:1";
  schemaVersion: 1;
  id: string;
  platform: string;
  category: "mod" | "plugin" | "proxy" | "multiloader" | "toolchain";
  adapter: string;
  sources: SourceResource[];
  removalPolicy: "additive-only";
  requestPolicy: {
    timeoutMs: number;
    maxBytes: number;
  };
};

export type SourceResourceRole = "primary" | "prerequisite" | "corroborating";

export type SourceResource = {
  id: string;
  role: SourceResourceRole;
  url: string;
  expectedContentTypes: string[];
};
