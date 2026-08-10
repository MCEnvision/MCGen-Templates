const sourceNetworkPolicies = {
  "mojang-version-manifest": {
    maxRedirects: 2,
    allowedUrls: [
      "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    ],
  },
  "forge-maven-metadata": {
    maxRedirects: 3,
    allowedUrls: [
      "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
      "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/maven-metadata.xml",
    ],
  },
} as const;

export type CanonicalSourceId = keyof typeof sourceNetworkPolicies;

function sourcePolicy(sourceId: CanonicalSourceId) {
  return sourceNetworkPolicies[sourceId];
}

export function sourceRedirectLimit(sourceId: CanonicalSourceId): number {
  return sourcePolicy(sourceId).maxRedirects;
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
  const policy = sourcePolicy(sourceId);
  const allowedUrl = policy.allowedUrls.find(
    (trustedUrl) => candidate.href === trustedUrl,
  );
  if (!allowedUrl) {
    throw new Error(
      `source url is outside the approved policy for ${sourceId}`,
    );
  }
  return new URL(allowedUrl);
}
