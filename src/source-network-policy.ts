import type { SourceDefinition } from "./contracts.js";

type SourceNetworkPolicy = {
  maxRedirects: number;
  allowedUrls: readonly string[];
  expectedContentTypes: readonly string[];
};

const sourceNetworkPolicies = {
  "mojang-version-manifest": {
    maxRedirects: 2,
    allowedUrls: [
      "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    ],
    expectedContentTypes: ["application/json"],
  },
  "forge-maven-metadata": {
    maxRedirects: 3,
    allowedUrls: [
      "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
      "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "forgegradle-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.minecraftforge.net/net/minecraftforge/gradle/ForgeGradle/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "mcp-config-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp_config/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "mcp-snapshot-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp_snapshot/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "mcp-stable-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.minecraftforge.net/de/oceanlabs/mcp/mcp_stable/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "forge-promotions": {
    maxRedirects: 2,
    allowedUrls: [
      "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
    ],
    expectedContentTypes: ["application/json"],
  },
} as const satisfies Record<string, SourceNetworkPolicy>;

export type CanonicalSourceId = keyof typeof sourceNetworkPolicies;

function sourcePolicy(sourceId: CanonicalSourceId) {
  return sourceNetworkPolicies[sourceId];
}

export function sourceRedirectLimit(sourceId: CanonicalSourceId): number {
  return sourcePolicy(sourceId).maxRedirects;
}

export function expectedSourceContentTypes(
  sourceId: CanonicalSourceId,
): readonly string[] {
  return sourcePolicy(sourceId).expectedContentTypes;
}

export function isCanonicalSourceId(value: string): value is CanonicalSourceId {
  return Object.hasOwn(sourceNetworkPolicies, value);
}

export function resolveCanonicalSourceUrl(
  sourceId: CanonicalSourceId,
  value: string,
): URL {
  let candidate: URL;
  try {
    candidate = new URL(value);
  } catch {
    throw new Error(`source url is invalid for ${sourceId}`);
  }
  if (candidate.protocol !== "https:") {
    throw new Error(`source url must use https for ${sourceId}`);
  }
  if (candidate.username || candidate.password) {
    throw new Error(`source url must not contain credentials for ${sourceId}`);
  }
  if (candidate.port) {
    throw new Error(
      `source url must not use a nonstandard port for ${sourceId}`,
    );
  }
  if (candidate.search || candidate.hash) {
    throw new Error(
      `source url must not contain a query or fragment for ${sourceId}`,
    );
  }
  const allowedUrl = sourcePolicy(sourceId).allowedUrls.find(
    (trustedUrl) => candidate.href === trustedUrl,
  );
  if (!allowedUrl) {
    throw new Error(
      `source url is outside the approved policy for ${sourceId}`,
    );
  }
  return new URL(allowedUrl);
}

export function sourceDefinitionPolicyFailures(
  definition: SourceDefinition,
): string[] {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const source of definition.sources) {
    if (ids.has(source.id)) {
      failures.push(`source definition repeats source id ${source.id}`);
      continue;
    }
    ids.add(source.id);
    if (!isCanonicalSourceId(source.id)) {
      failures.push(`source definition uses unknown policy ${source.id}`);
      continue;
    }
    try {
      resolveCanonicalSourceUrl(source.id, source.url);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
    const expected = expectedSourceContentTypes(source.id);
    for (const contentType of source.expectedContentTypes) {
      if (!expected.includes(contentType)) {
        failures.push(
          `source definition content type ${contentType} is outside the approved policy for ${source.id}`,
        );
      }
    }
  }
  if (!definition.sources.some((source) => source.role === "primary")) {
    failures.push("source definition must declare one primary source");
  }
  return failures;
}
