import type {
  FetchedResource,
  SourceDefinition,
  SourceSnapshot,
} from "./contracts.js";
import { buildForgeSnapshot } from "./sources/forge.js";
import { buildGradleSnapshot } from "./sources/gradle.js";
import { buildJavaSnapshot } from "./sources/java.js";
import { buildFabricSnapshot } from "./sources/fabric.js";
import {
  apiLine,
  buildMavenPlatformSnapshot,
  globalKey,
  minecraftKey,
  type MavenPlatformAdapterOptions,
} from "./sources/maven-platform.js";
import { buildMojangSnapshot } from "./sources/mojang.js";
import { buildPaperSnapshot } from "./sources/paper.js";
import { buildNeoForgeSnapshot } from "./sources/neoforge.js";

export type SourceAdapter = {
  id: string;
  adapterId: string;
  snapshotDirectory: string;
  requiredSourceIds: readonly string[];
  build: (
    resources: ReadonlyMap<string, FetchedResource>,
    createdAt: string,
  ) => SourceSnapshot;
};

function mavenAdapter(options: MavenPlatformAdapterOptions): SourceAdapter {
  return {
    id: options.platform,
    adapterId: options.id,
    snapshotDirectory: options.platform,
    requiredSourceIds: options.requiredSourceIds,
    build: (resources, createdAt) =>
      buildMavenPlatformSnapshot(resources, createdAt, options),
  };
}

const sourceAdapters = [
  {
    id: "forge",
    adapterId: "forge-maven",
    snapshotDirectory: "forge",
    requiredSourceIds: [
      "mojang-version-manifest",
      "forge-maven-metadata",
      "forgegradle-maven-metadata",
      "mcp-config-maven-metadata",
      "mcp-snapshot-maven-metadata",
      "mcp-stable-maven-metadata",
      "forge-promotions",
    ],
    build: buildForgeSnapshot,
  },
  {
    id: "mojang",
    adapterId: "mojang-version-manifest",
    snapshotDirectory: "mojang",
    requiredSourceIds: ["mojang-version-manifest"],
    build: buildMojangSnapshot,
  },
  {
    id: "paper",
    adapterId: "paper-fill",
    snapshotDirectory: "paper",
    requiredSourceIds: ["paper-fill-project", "paper-api-maven-metadata"],
    build: buildPaperSnapshot,
  },
  {
    id: "gradle",
    adapterId: "gradle-releases",
    snapshotDirectory: "gradle",
    requiredSourceIds: ["gradle-versions"],
    build: buildGradleSnapshot,
  },
  {
    id: "java",
    adapterId: "java-requirements",
    snapshotDirectory: "java",
    requiredSourceIds: [
      "mojang-version-manifest",
      "forge-getting-started-documentation",
      "neoforge-user-documentation",
      "paper-getting-started-documentation",
      "velocity-getting-started-documentation",
      "architectury-setup-documentation",
    ],
    build: buildJavaSnapshot,
  },
  {
    id: "fabric",
    adapterId: "fabric-meta",
    snapshotDirectory: "fabric",
    requiredSourceIds: [
      "fabric-meta-game",
      "fabric-meta-loader",
      "fabric-meta-yarn",
      "fabric-meta-intermediary",
      "fabric-meta-installer",
      "fabric-api-maven-metadata",
      "fabric-loom-maven-metadata",
      "fabric-language-kotlin-maven-metadata",
    ],
    build: buildFabricSnapshot,
  },
  {
    id: "neoforge",
    adapterId: "neoforge-maven",
    snapshotDirectory: "neoforge",
    requiredSourceIds: [
      "neoforge-maven-metadata",
      "neoforge-moddevgradle-maven-metadata",
      "neoforge-userdev-maven-metadata",
      "neoforge-common-maven-metadata",
      "neoforge-neoform-maven-metadata",
      "neoforge-neoform-runtime-maven-metadata",
      "neoforge-versioning-documentation",
    ],
    build: buildNeoForgeSnapshot,
  },
  mavenAdapter({
    id: "spigot-maven",
    version: "1.0.0",
    platform: "spigot",
    requiredSourceIds: ["spigot-api-maven-metadata"],
    components: [
      {
        sourceId: "spigot-api-maven-metadata",
        component: "spigot-api",
        coordinate: "org.spigotmc:spigot-api",
        catalogKey: minecraftKey,
      },
    ],
  }),
  mavenAdapter({
    id: "bukkit-maven",
    version: "1.0.0",
    platform: "bukkit",
    requiredSourceIds: ["bukkit-api-maven-metadata"],
    components: [
      {
        sourceId: "bukkit-api-maven-metadata",
        component: "bukkit-api",
        coordinate: "org.bukkit:bukkit",
        catalogKey: minecraftKey,
      },
    ],
  }),
  mavenAdapter({
    id: "sponge-maven",
    version: "1.0.0",
    platform: "sponge",
    requiredSourceIds: [
      "sponge-api-maven-metadata",
      "sponge-versioning-documentation",
      "sponge-implementations-documentation",
    ],
    components: [
      {
        sourceId: "sponge-api-maven-metadata",
        component: "sponge-api",
        coordinate: "org.spongepowered:spongeapi",
        catalogKey: apiLine,
      },
    ],
  }),
  mavenAdapter({
    id: "velocity-maven",
    version: "1.0.0",
    platform: "velocity",
    requiredSourceIds: [
      "velocity-api-maven-metadata",
      "velocity-server-compatibility-documentation",
      "velocity-player-information-forwarding-documentation",
    ],
    components: [
      {
        sourceId: "velocity-api-maven-metadata",
        component: "velocity-api",
        coordinate: "com.velocitypowered:velocity-api",
        catalogKey: apiLine,
      },
    ],
  }),
  mavenAdapter({
    id: "bungeecord-maven",
    version: "1.0.0",
    platform: "bungeecord",
    requiredSourceIds: ["bungeecord-api-maven-metadata"],
    components: [
      {
        sourceId: "bungeecord-api-maven-metadata",
        component: "bungeecord-api",
        coordinate: "net.md-5:bungeecord-api",
        catalogKey: apiLine,
      },
    ],
  }),
  mavenAdapter({
    id: "architectury-maven",
    version: "1.0.0",
    platform: "architectury",
    requiredSourceIds: [
      "architectury-api-maven-metadata",
      "architectury-fabric-maven-metadata",
      "architectury-neoforge-maven-metadata",
      "architectury-loom-maven-metadata",
      "architectury-setup-documentation",
    ],
    components: [
      {
        sourceId: "architectury-api-maven-metadata",
        component: "architectury-api",
        coordinate: "dev.architectury:architectury",
        catalogKey: apiLine,
      },
      {
        sourceId: "architectury-fabric-maven-metadata",
        component: "architectury-fabric",
        coordinate: "dev.architectury:architectury-fabric",
        catalogKey: apiLine,
      },
      {
        sourceId: "architectury-neoforge-maven-metadata",
        component: "architectury-neoforge",
        coordinate: "dev.architectury:architectury-neoforge",
        catalogKey: apiLine,
      },
      {
        sourceId: "architectury-loom-maven-metadata",
        component: "architectury-loom",
        coordinate: "dev.architectury:architectury-loom",
        catalogKey: globalKey,
      },
    ],
  }),
  mavenAdapter({
    id: "kotlin-gradle-plugin",
    version: "1.0.0",
    platform: "kotlin",
    requiredSourceIds: [
      "kotlin-jvm-plugin-maven-metadata",
      "kotlin-gradle-documentation",
    ],
    components: [
      {
        sourceId: "kotlin-jvm-plugin-maven-metadata",
        component: "kotlin-jvm-plugin",
        coordinate:
          "org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin",
        catalogKey: apiLine,
      },
    ],
  }),
] as const satisfies readonly SourceAdapter[];

export function requireSourceAdapter(id: string): SourceAdapter {
  const adapter = sourceAdapters.find((candidate) => candidate.id === id);
  if (!adapter) {
    throw new Error(`source adapter ${id} is not registered`);
  }
  return adapter;
}

export function requireSourceAdapterByAdapterId(
  adapterId: string,
): SourceAdapter {
  const adapter = sourceAdapters.find(
    (candidate) => candidate.adapterId === adapterId,
  );
  if (!adapter) {
    throw new Error(`source adapter ${adapterId} is not registered`);
  }
  return adapter;
}

export function sourceAdapterFailures(definition: SourceDefinition): string[] {
  let adapter: SourceAdapter;
  try {
    adapter = requireSourceAdapter(definition.id);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  if (definition.adapter !== adapter.adapterId) {
    return [
      `source definition adapter ${definition.adapter} does not match ${adapter.adapterId}`,
    ];
  }
  const declared = definition.sources.map((source) => source.id).sort();
  const required = [...adapter.requiredSourceIds].sort();
  if (
    declared.length !== required.length ||
    declared.some((sourceId, index) => sourceId !== required[index])
  ) {
    return ["source definition resources do not match its registered adapter"];
  }
  return [];
}
