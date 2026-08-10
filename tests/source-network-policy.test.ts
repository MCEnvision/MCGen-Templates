import { describe, expect, it } from "vitest";
import type { SourceDefinition, SourceResource } from "../src/contracts.js";
import { sourceDefinitionPolicyFailures } from "../src/source-network-policy.js";

const primarySource: SourceResource = {
  id: "forge-maven-metadata",
  role: "primary",
  url: "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
  expectedContentTypes: ["application/xml", "text/xml"],
};

const definition: SourceDefinition = {
  $schema: "urn:mcgen:schema:source-definition:1",
  schemaVersion: 1,
  id: "forge",
  platform: "forge",
  category: "mod",
  adapter: "forge-maven",
  sources: [primarySource],
  removalPolicy: "additive-only",
  requestPolicy: { timeoutMs: 30_000, maxBytes: 1_048_576 },
};

describe("source definition network policy", () => {
  it("accepts a named primary source with its approved content types", () => {
    expect(sourceDefinitionPolicyFailures(definition)).toEqual([]);
  });

  it("rejects unknown source ids, noncanonical urls, and unapproved content types", () => {
    expect(
      sourceDefinitionPolicyFailures({
        ...definition,
        sources: [
          {
            ...primarySource,
            id: "unreviewed-source",
          },
          {
            ...primarySource,
            id: "forgegradle-maven-metadata",
            url: "https://maven.minecraftforge.net/not-reviewed.xml",
            expectedContentTypes: ["application/json"],
          },
        ],
      }),
    ).toEqual([
      "source definition uses unknown policy unreviewed-source",
      "source url is outside the approved policy for forgegradle-maven-metadata",
      "source definition content type application/json is outside the approved policy for forgegradle-maven-metadata",
      "source definition must declare exactly one primary source",
    ]);
  });

  it("requires each declared derived source to use a named policy and static parent", () => {
    expect(
      sourceDefinitionPolicyFailures({
        ...definition,
        derivedSources: [
          {
            id: "unreviewed-derived-source",
            parentSourceId: "missing-parent",
            role: "prerequisite",
          },
        ],
      }),
    ).toEqual([
      "source definition uses unknown derived policy unreviewed-derived-source",
      "derived source unreviewed-derived-source parent is not a declared static source",
    ]);
  });
});
