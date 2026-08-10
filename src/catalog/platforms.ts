import type { CatalogKeyKind } from "./contracts.js";

const keyKindByPlatform: Readonly<Record<string, CatalogKeyKind>> = {
  architectury: "minecraft",
  bukkit: "minecraft",
  bungeecord: "api",
  fabric: "minecraft",
  forge: "minecraft",
  gradle: "api",
  java: "minecraft",
  kotlin: "api",
  minecraft: "minecraft",
  mojang: "minecraft",
  neoforge: "minecraft",
  paper: "minecraft",
  spigot: "minecraft",
  sponge: "api",
  velocity: "api",
};

export function requireCatalogKeyKind(platform: string): CatalogKeyKind {
  const keyKind = keyKindByPlatform[platform];
  if (!keyKind) {
    throw new Error(`catalog generation has no key kind for ${platform}`);
  }
  return keyKind;
}
