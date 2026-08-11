import type {
  DerivedSourceResource,
  SourceDefinition,
  SourceRecord,
} from "./contracts.js";

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
  "mojang-version-metadata": {
    maxRedirects: 0,
    allowedUrls: [],
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
  "neoforge-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-moddev-gradle-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/moddev-gradle/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neogradle-userdev-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/gradle/userdev/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neogradle-common-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/gradle/common/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoform-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/neoform/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoform-runtime-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/neoform-runtime/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-project": {
    maxRedirects: 2,
    allowedUrls: ["https://projects.neoforged.net/neoforged/neoforge"],
    expectedContentTypes: ["text/html"],
  },
  "neoforge-moddev-project": {
    maxRedirects: 2,
    allowedUrls: ["https://projects.neoforged.net/neoforged/ModDevGradle"],
    expectedContentTypes: ["text/html"],
  },
  "fabric-meta-game": {
    maxRedirects: 2,
    allowedUrls: ["https://meta.fabricmc.net/v2/versions/game"],
    expectedContentTypes: ["application/json"],
  },
  "fabric-meta-loader": {
    maxRedirects: 2,
    allowedUrls: ["https://meta.fabricmc.net/v2/versions/loader"],
    expectedContentTypes: ["application/json"],
  },
  "fabric-meta-yarn": {
    maxRedirects: 2,
    allowedUrls: ["https://meta.fabricmc.net/v2/versions/yarn"],
    expectedContentTypes: ["application/json"],
  },
  "fabric-meta-intermediary": {
    maxRedirects: 2,
    allowedUrls: ["https://meta.fabricmc.net/v2/versions/intermediary"],
    expectedContentTypes: ["application/json"],
  },
  "fabric-meta-installer": {
    maxRedirects: 2,
    allowedUrls: ["https://meta.fabricmc.net/v2/versions/installer"],
    expectedContentTypes: ["application/json"],
  },
  "fabric-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.fabricmc.net/net/fabricmc/fabric-api/fabric-api/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "fabric-loom-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.fabricmc.net/net/fabricmc/fabric-loom/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "fabric-language-kotlin-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.fabricmc.net/net/fabricmc/fabric-language-kotlin/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "paper-fill-project": {
    maxRedirects: 2,
    allowedUrls: ["https://fill.papermc.io/v3/projects/paper"],
    expectedContentTypes: ["application/json"],
  },
  "paper-fill-builds": {
    maxRedirects: 0,
    allowedUrls: [],
    expectedContentTypes: ["application/json"],
  },
  "paper-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "spigot-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://hub.spigotmc.org/nexus/content/groups/public/org/spigotmc/spigot-api/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "bukkit-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://hub.spigotmc.org/nexus/content/groups/public/org/bukkit/bukkit/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "sponge-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://repo.spongepowered.org/repository/maven-public/org/spongepowered/spongeapi/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "sponge-versioning-documentation": {
    maxRedirects: 2,
    allowedUrls: [
      "https://docs.spongepowered.org/stable/en/versions/versioning.html",
    ],
    expectedContentTypes: ["text/html"],
  },
  "sponge-implementation-documentation": {
    maxRedirects: 2,
    allowedUrls: [
      "https://docs.spongepowered.org/stable/en/server/getting-started/implementations/index.html",
    ],
    expectedContentTypes: ["text/html"],
  },
  "velocity-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://repo.papermc.io/repository/maven-public/com/velocitypowered/velocity-api/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "velocity-compatibility-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.papermc.io/velocity/server-compatibility/"],
    expectedContentTypes: ["text/html"],
  },
  "velocity-forwarding-documentation": {
    maxRedirects: 2,
    allowedUrls: [
      "https://docs.papermc.io/velocity/player-information-forwarding/",
    ],
    expectedContentTypes: ["text/html"],
  },
  "bungeecord-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://hub.spigotmc.org/nexus/content/groups/public/net/md-5/bungeecord-api/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-api-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.architectury.dev/dev/architectury/architectury/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-fabric-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.architectury.dev/dev/architectury/architectury-fabric/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-neoforge-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.architectury.dev/dev/architectury/architectury-neoforge/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-forge-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.architectury.dev/dev/architectury/architectury-forge/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-loom-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.architectury.dev/dev/architectury/architectury-loom/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-plugin-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.architectury.dev/architectury-plugin/architectury-plugin.gradle.plugin/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "architectury-setup-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.architectury.dev/api/getting-started/setup/"],
    expectedContentTypes: ["text/html"],
  },
  "gradle-versions": {
    maxRedirects: 2,
    allowedUrls: ["https://services.gradle.org/versions/all"],
    expectedContentTypes: ["application/json"],
  },
  "kotlin-gradle-plugin-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://plugins.gradle.org/m2/org/jetbrains/kotlin/jvm/org.jetbrains.kotlin.jvm.gradle.plugin/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "kotlin-gradle-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://kotlinlang.org/docs/gradle-configure-project.html"],
    expectedContentTypes: ["text/html"],
  },
  "kotlin-jvm-plugin-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://plugins.gradle.org/m2/org/jetbrains/kotlin/jvm/org.jetbrains.kotlin.jvm.gradle.plugin/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-moddevgradle-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/moddev-gradle/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-userdev-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/gradle/userdev/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-common-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/gradle/common/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-neoform-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/gradle/neoform/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-neoform-runtime-maven-metadata": {
    maxRedirects: 2,
    allowedUrls: [
      "https://maven.neoforged.net/releases/net/neoforged/neoform-runtime/maven-metadata.xml",
    ],
    expectedContentTypes: ["application/xml", "text/xml"],
  },
  "neoforge-versioning-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.neoforged.net/docs/gettingstarted/versioning/"],
    expectedContentTypes: ["text/html"],
  },
  "forge-getting-started-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.minecraftforge.net/en/latest/gettingstarted/"],
    expectedContentTypes: ["text/html"],
  },
  "neoforge-user-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.neoforged.net/user/docs/"],
    expectedContentTypes: ["text/html"],
  },
  "paper-getting-started-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.papermc.io/paper/getting-started/"],
    expectedContentTypes: ["text/html"],
  },
  "velocity-getting-started-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.papermc.io/velocity/getting-started/"],
    expectedContentTypes: ["text/html"],
  },
  "sponge-implementations-documentation": {
    maxRedirects: 2,
    allowedUrls: [
      "https://docs.spongepowered.org/stable/en/server/getting-started/implementations/index.html",
    ],
    expectedContentTypes: ["text/html"],
  },
  "velocity-server-compatibility-documentation": {
    maxRedirects: 2,
    allowedUrls: ["https://docs.papermc.io/velocity/server-compatibility/"],
    expectedContentTypes: ["text/html"],
  },
  "velocity-player-information-forwarding-documentation": {
    maxRedirects: 2,
    allowedUrls: [
      "https://docs.papermc.io/velocity/player-information-forwarding/",
    ],
    expectedContentTypes: ["text/html"],
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

function requireDerivedParent(
  parent: SourceRecord,
  sourceId: CanonicalSourceId,
): NonNullable<SourceRecord["sourceId"]> {
  if (!parent.sourceId || parent.sourceId !== sourceId) {
    throw new Error(`derived source parent must be ${sourceId}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(parent.sha256)) {
    throw new Error("derived source parent hash is invalid");
  }
  return parent.sourceId;
}

function requireDerivedVersion(value: string, label: string): string {
  if (
    value.length === 0 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9._-]+$/u.test(value)
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function requireMojangVersionId(value: string): string {
  if (
    value.length === 0 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9 ._-]+$/u.test(value)
  ) {
    throw new Error("mojang version id is invalid");
  }
  return value;
}

function derivedResource(
  key: string,
  id: CanonicalSourceId,
  role: DerivedSourceResource["role"],
  url: string,
  parent: SourceRecord,
  selector: string,
): DerivedSourceResource {
  return {
    key,
    id,
    role,
    url,
    expectedContentTypes: [...expectedSourceContentTypes(id)],
    derivedFrom: {
      sourceId: parent.sourceId ?? "",
      sha256: parent.sha256,
      selector,
    },
  };
}

export function deriveMojangVersionMetadataSource(
  parent: SourceRecord,
  version: { id: string; sha1: string; url: string },
): DerivedSourceResource {
  requireDerivedParent(parent, "mojang-version-manifest");
  const id = requireMojangVersionId(version.id);
  if (!/^[a-f0-9]{40}$/u.test(version.sha1)) {
    throw new Error("mojang version metadata sha1 is invalid");
  }
  const url = `https://piston-meta.mojang.com/v1/packages/${version.sha1}/${encodeURIComponent(id)}.json`;
  if (version.url !== url) {
    throw new Error(
      "mojang version metadata url does not match its manifest id and sha1",
    );
  }
  return derivedResource(
    `mojang-version-metadata:${id}`,
    "mojang-version-metadata",
    "prerequisite",
    url,
    parent,
    `version:${id}`,
  );
}

export function derivePaperFillBuildsSource(
  parent: SourceRecord,
  version: string,
): DerivedSourceResource {
  requireDerivedParent(parent, "paper-fill-project");
  const minecraftVersion = requireDerivedVersion(
    version,
    "paper minecraft version",
  );
  return derivedResource(
    `paper-fill-builds:${minecraftVersion}`,
    "paper-fill-builds",
    "prerequisite",
    `https://fill.papermc.io/v3/projects/paper/versions/${encodeURIComponent(minecraftVersion)}/builds`,
    parent,
    `version:${minecraftVersion}`,
  );
}

function requireDerivedUrl(source: DerivedSourceResource): URL {
  const parent = source.derivedFrom;
  if (source.id === "mojang-version-metadata") {
    if (parent.sourceId !== "mojang-version-manifest") {
      throw new Error("mojang metadata provenance parent is invalid");
    }
    const match = /^version:([A-Za-z0-9 ._-]+)$/u.exec(parent.selector);
    if (!match) {
      throw new Error("mojang metadata provenance selector is invalid");
    }
    const candidate = new URL(source.url);
    const expectedPath =
      /^\/v1\/packages\/([a-f0-9]{40})\/((?:[A-Za-z0-9._-]|%[A-F0-9]{2})+)\.json$/u.exec(
        candidate.pathname,
      );
    if (
      candidate.protocol !== "https:" ||
      candidate.hostname !== "piston-meta.mojang.com" ||
      candidate.port ||
      candidate.username ||
      candidate.password ||
      candidate.search ||
      candidate.hash ||
      !expectedPath ||
      decodeURIComponent(expectedPath[2] ?? "") !== match[1]
    ) {
      throw new Error(
        "mojang metadata url is outside the derived source policy",
      );
    }
    return candidate;
  }
  if (source.id === "paper-fill-builds") {
    if (parent.sourceId !== "paper-fill-project") {
      throw new Error("paper build provenance parent is invalid");
    }
    const match = /^version:([A-Za-z0-9._-]+)$/u.exec(parent.selector);
    if (!match) {
      throw new Error("paper build provenance selector is invalid");
    }
    const candidate = new URL(source.url);
    const expectedPath =
      /^\/v3\/projects\/paper\/versions\/([A-Za-z0-9._-]+)\/builds$/u.exec(
        candidate.pathname,
      );
    if (
      candidate.protocol !== "https:" ||
      candidate.hostname !== "fill.papermc.io" ||
      candidate.port ||
      candidate.username ||
      candidate.password ||
      candidate.search ||
      candidate.hash ||
      !expectedPath ||
      decodeURIComponent(expectedPath[1] ?? "") !== match[1]
    ) {
      throw new Error("paper build url is outside the derived source policy");
    }
    return candidate;
  }
  throw new Error(`source ${source.id} is not an approved derived source`);
}

export function resolveDerivedSourceUrl(source: DerivedSourceResource): URL {
  if (!isCanonicalSourceId(source.id)) {
    throw new Error(
      `derived source id is outside the approved policy for ${source.id}`,
    );
  }
  if (!/^[a-f0-9]{64}$/u.test(source.derivedFrom.sha256)) {
    throw new Error("derived source provenance hash is invalid");
  }
  return requireDerivedUrl(source);
}

export function resolveCapturedSourceUrl(
  source: Pick<SourceRecord, "sourceId" | "role" | "url" | "derivedFrom">,
): URL {
  if (!source.sourceId || !isCanonicalSourceId(source.sourceId)) {
    throw new Error("captured source has an unknown source id");
  }
  if (
    source.sourceId === "mojang-version-metadata" ||
    source.sourceId === "paper-fill-builds"
  ) {
    if (!source.role || source.role === "primary" || !source.derivedFrom) {
      throw new Error("captured derived source provenance is incomplete");
    }
    return resolveDerivedSourceUrl({
      id: source.sourceId,
      role: source.role,
      url: source.url,
      expectedContentTypes: [...expectedSourceContentTypes(source.sourceId)],
      key: "captured-source",
      derivedFrom: source.derivedFrom,
    });
  }
  return resolveCanonicalSourceUrl(source.sourceId, source.url);
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
  const primarySources = definition.sources.filter(
    (source) => source.role === "primary",
  );
  if (primarySources.length !== 1) {
    failures.push("source definition must declare exactly one primary source");
  }
  const derivedIds = new Set<string>();
  for (const derivedSource of definition.derivedSources ?? []) {
    if (derivedIds.has(derivedSource.id)) {
      failures.push(
        `source definition repeats derived source id ${derivedSource.id}`,
      );
      continue;
    }
    derivedIds.add(derivedSource.id);
    if (!isCanonicalSourceId(derivedSource.id)) {
      failures.push(
        `source definition uses unknown derived policy ${derivedSource.id}`,
      );
    }
    if (!ids.has(derivedSource.parentSourceId)) {
      failures.push(
        `derived source ${derivedSource.id} parent is not a declared static source`,
      );
    }
  }
  return failures;
}
