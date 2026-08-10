import { fetchDerivedResource, fetchResource } from "./fetch-resource.js";
import type {
  DerivedSourceResource,
  FetchedResource,
  SourceDefinition,
  SourceSnapshot,
  SourceResource,
} from "./contracts.js";
import { loadSourceDefinition } from "./source-definition.js";
import { requireSourceAdapter, type SourceAdapter } from "./source-adapters.js";

export type SourceCaptureOptions = {
  fetch?: (
    source: SourceResource,
    requestPolicy: SourceDefinition["requestPolicy"],
  ) => Promise<FetchedResource>;
  fetchDerived?: (
    source: DerivedSourceResource,
    requestPolicy: SourceDefinition["requestPolicy"],
  ) => Promise<FetchedResource>;
};

async function fetchAll<T>(
  values: readonly T[],
  operation: (value: T) => Promise<FetchedResource>,
): Promise<FetchedResource[]> {
  const results = new Array<FetchedResource>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      const value = values[index];
      if (value === undefined) return;
      results[index] = await operation(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(8, values.length) }, () => worker()),
  );
  return results;
}

export async function captureSourceSnapshot(
  sourceId: string,
  createdAt: string,
  options: SourceCaptureOptions = {},
): Promise<{ adapter: SourceAdapter; snapshot: SourceSnapshot }> {
  const adapter = requireSourceAdapter(sourceId);
  const definition = await loadSourceDefinition(adapter.id);
  const fetch = options.fetch ?? fetchResource;
  const fetchDerived = options.fetchDerived ?? fetchDerivedResource;
  const fetched = await fetchAll(definition.sources, (source) =>
    fetch(source, definition.requestPolicy),
  );
  const resources = new Map<string, FetchedResource>();
  for (const [index, resource] of fetched.entries()) {
    const source = definition.sources[index];
    if (!source) throw new Error("fetched source has no definition resource");
    resources.set(source.id, resource);
  }
  const derivedSources = adapter.derive?.(resources) ?? [];
  for (const source of derivedSources) {
    if (resources.has(source.key)) {
      throw new Error(`derived source key is duplicated ${source.key}`);
    }
  }
  const derivedFetched = await fetchAll(derivedSources, (source) =>
    fetchDerived(source, definition.requestPolicy),
  );
  for (const [index, source] of derivedSources.entries()) {
    const resource = derivedFetched[index];
    if (!resource)
      throw new Error(`derived source was not fetched ${source.key}`);
    resources.set(source.key, resource);
  }
  return { adapter, snapshot: adapter.build(resources, createdAt) };
}
