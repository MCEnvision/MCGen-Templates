export type ProfileDocument = {
  id: string;
  status: "reviewed" | "blocked";
  platform: string;
  family: string;
  catalog: {
    selectors: readonly {
      platform: string;
      keys: { mode: "all-shards" | "explicit"; values?: readonly string[] };
      components: readonly {
        component: string;
        coordinatePrefix: string;
        mode: "all-components" | "explicit";
        versions?: readonly string[];
      }[];
    }[];
  };
  blockers?: readonly { code: string; reason: string }[];
};

export type ProfileSelection = {
  platform: string;
  catalogKey: string;
  components: Readonly<Record<string, string>>;
};

export type ProfileResolution =
  | { status: "matched"; profile: ProfileDocument }
  | { status: "blocked"; profileId?: string; reasons: readonly string[] }
  | { status: "ambiguous"; profileIds: readonly string[] };

function selectorMatches(
  selector: ProfileDocument["catalog"]["selectors"][number],
  selection: ProfileSelection,
): boolean {
  if (selector.platform !== selection.platform) return false;
  if (
    selector.keys.mode === "explicit" &&
    !selector.keys.values?.includes(selection.catalogKey)
  )
    return false;
  for (const component of selector.components) {
    const selected = selection.components[component.component];
    if (!selected) return false;
    const exactVersion = component.versions?.includes(selected) ?? false;
    const coordinate = selected.startsWith(component.coordinatePrefix);
    const bareVersion = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/.test(selected);
    if (!exactVersion && !coordinate && !bareVersion) return false;
    if (component.mode === "explicit" && !exactVersion && !coordinate)
      return false;
  }
  return true;
}

export function resolveProfile(
  profiles: readonly ProfileDocument[],
  selection: ProfileSelection,
): ProfileResolution {
  const matches = profiles.filter(
    (profile) =>
      profile.platform === selection.platform &&
      profile.catalog.selectors.some((selector) =>
        selectorMatches(selector, selection),
      ),
  );
  if (matches.length === 0)
    return {
      status: "blocked",
      reasons: [
        `no reviewed profile matches ${selection.platform}:${selection.catalogKey}`,
      ],
    };
  const blocked = matches.filter((profile) => profile.status === "blocked");
  if (blocked.length > 0) {
    return {
      status: "blocked",
      ...(blocked[0]?.id ? { profileId: blocked[0].id } : {}),
      reasons: blocked.flatMap(
        (profile) =>
          profile.blockers?.map(
            (blocker) => `${profile.id}: ${blocker.code}: ${blocker.reason}`,
          ) ?? [`${profile.id}: profile is blocked`],
      ),
    };
  }
  if (matches.length > 1)
    return {
      status: "ambiguous",
      profileIds: matches.map((profile) => profile.id).sort(),
    };
  const profile = matches[0];
  if (!profile)
    return {
      status: "blocked",
      reasons: ["profile resolution returned no profile"],
    };
  return { status: "matched", profile };
}
