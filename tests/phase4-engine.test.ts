import { describe, expect, it } from "vitest";
import {
  applyFileOperations,
  diffFileTrees,
  normalizeProjectPath,
} from "../src/file-operations.js";
import { validatePng } from "../src/png.js";
import { evaluateCondition } from "../src/conditions.js";
import {
  resolveProfile,
  type ProfileDocument,
} from "../src/profile-resolver.js";
import {
  resolveProjectSpec,
  switchProjectMode,
  type ProjectSpec,
} from "../src/project-spec.js";
import { renderTemplate } from "../src/template-renderer.js";

const png = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

const spec: ProjectSpec = {
  $schema: "urn:mcgen:schema:project-spec:1",
  schemaVersion: 1,
  template: "mod.fabric",
  mode: "simple",
  project: {
    name: "Example Mod",
    id: "example-mod",
    package: "org.example.mod",
    mainClass: "ExampleMod",
    version: "1.0-beta.1",
  },
  platform: {
    id: "fabric",
    catalogKey: "1.21.1",
    components: { loader: "0.16.14" },
  },
  metadata: {},
  build: { system: "gradle", dsl: "kotlin" },
  dependencies: [],
  repositories: [],
  sourceLayout: {},
  features: [],
  assets: [],
  publishing: {},
  repository: {},
  targetOverrides: [],
  fileOperations: [],
  extensions: {},
};

describe("phase 4 engine contracts", () => {
  it("validates png bytes and preserves their digest", () => {
    const info = validatePng(png);
    expect(info.width).toBe(1);
    expect(info.height).toBe(1);
    expect(info.bytes).toBe(png.length);
    expect(info.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(() => validatePng(png.slice(1))).toThrow("signature");
  });

  it("rejects traversal and case folded collisions", () => {
    expect(() => normalizeProjectPath("../settings.gradle")).toThrow("unsafe");
    expect(() =>
      applyFileOperations(new Map([["src/Main.java", new Uint8Array([1])]]), [
        {
          kind: "add",
          path: "SRC/main.java",
          content: new Uint8Array([2]),
          trust: "canonical",
        },
      ]),
    ).toThrow("case folded");
  });

  it("applies deterministic operations and reports changes", () => {
    const before = new Map([["README.md", new Uint8Array([1])]]);
    const after = applyFileOperations(before, [
      {
        kind: "replace",
        path: "README.md",
        content: new Uint8Array([2]),
        trust: "canonical",
      },
      {
        kind: "add",
        path: "src/Main.java",
        content: new Uint8Array([3]),
        trust: "canonical",
      },
    ]);
    expect([...after.keys()]).toEqual(["README.md", "src/Main.java"]);
    expect(diffFileTrees(before, after)).toEqual([
      { path: "README.md", kind: "changed" },
      { path: "src/Main.java", kind: "added" },
    ]);
  });

  it("supports reset, diff, and binary encoded raw operations", () => {
    const before = new Map([["README.md", new Uint8Array([1])]]);
    const after = applyFileOperations(before, [
      {
        kind: "reset",
        path: "README.md",
        content: new Uint8Array([2]),
        trust: "custom-unverified",
      },
      { kind: "diff", path: "README.md", trust: "custom-unverified" },
    ]);
    expect(after.get("README.md")).toEqual(new Uint8Array([2]));
    const rendered = renderTemplate({
      descriptorId: "raw",
      spec: {
        ...spec,
        fileOperations: [
          {
            kind: "add",
            path: "icon.bin",
            content: "AQID",
            encoding: "base64",
            trust: "custom-unverified",
          },
        ],
      },
      files: [],
    });
    expect(rendered.files.get("icon.bin")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("keeps advanced values dormant across a mode switch", () => {
    const advanced = switchProjectMode(spec, "advanced");
    expect(advanced.mode).toBe("advanced");
    expect(switchProjectMode(advanced, "simple").dormant).toMatchObject({
      advanced: spec.build,
    });
    expect(resolveProjectSpec(advanced).digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("renders metadata and raw text without executing it", () => {
    const result = renderTemplate({
      descriptorId: "mod.fabric",
      spec: {
        ...spec,
        mode: "advanced",
        fileOperations: [
          {
            kind: "add",
            path: "build.gradle",
            content: "plugins {}",
            trust: "custom-unverified",
          },
        ],
      },
      files: [
        {
          path: "README.md",
          content: "# ${project.name}\nversion ${project.version}\n",
        },
      ],
      metadata: [
        {
          path: "src/main/resources/mod.json",
          format: "json",
          value: { id: "${project.id}" },
        },
      ],
    });
    expect(result.files.has("build.gradle")).toBe(true);
    expect(new TextDecoder().decode(result.files.get("README.md"))).toContain(
      "Example Mod",
    );
    expect(result.treeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.warnings).toContain(
      "advanced values are preserved and require isolated verification",
    );
  });

  it("serializes supported metadata formats deterministically", () => {
    const result = renderTemplate({
      descriptorId: "metadata",
      spec,
      files: [],
      metadata: [
        {
          path: "plugin.yml",
          format: "yaml",
          value: {
            version: "${project.version}",
            name: "${project.name}",
            commands: { shop: { description: "open shop" } },
          },
        },
        {
          path: "mods.toml",
          format: "toml",
          value: {
            version: "${project.version}",
            mod: { id: "${project.id}" },
          },
        },
        {
          path: "gradle.properties",
          format: "properties",
          value: { version: "${project.version}" },
        },
        {
          path: "icon.png",
          format: "binary",
          value: png,
        },
      ],
    });
    expect(new TextDecoder().decode(result.files.get("plugin.yml"))).toBe(
      'commands:\n  shop:\n    description: "open shop"\nname: "Example Mod"\nversion: "1.0-beta.1"\n',
    );
    expect(new TextDecoder().decode(result.files.get("mods.toml"))).toBe(
      'version = "1.0-beta.1"\n[mod]\nid = "example-mod"\n',
    );
    expect(
      new TextDecoder().decode(result.files.get("gradle.properties")),
    ).toBe("version=1.0-beta.1\n");
    expect(result.files.get("icon.png")).toEqual(png);
  });

  it("evaluates only the bounded condition language", () => {
    const context = {
      fields: { loader: "0.16.14" },
      features: new Set(["mixins"]),
    };
    expect(
      evaluateCondition(
        'feature("mixins") && field("loader") == "0.16.14"',
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        'feature("missing") || field("loader") != "0.15"',
        context,
      ),
    ).toBe(true);
    expect(() => evaluateCondition("process.env.SECRET", context)).toThrow(
      "unsafe",
    );
  });

  it("resolves one profile or reports an explicit blocker or ambiguity", () => {
    const base: ProfileDocument = {
      id: "fabric",
      status: "reviewed",
      platform: "fabric",
      family: "fabric",
      catalog: {
        selectors: [
          {
            platform: "fabric",
            keys: { mode: "explicit", values: ["1.21.1"] },
            components: [
              {
                component: "loader",
                coordinatePrefix: "net.fabricmc:fabric-loader:",
                mode: "explicit",
                versions: ["0.16.14"],
              },
            ],
          },
        ],
      },
    };
    const baseSelector = base.catalog.selectors[0];
    if (!baseSelector) throw new Error("base selector is missing");
    const baseComponent = baseSelector.components[0];
    if (!baseComponent) throw new Error("base component is missing");
    expect(
      resolveProfile([base], {
        platform: "fabric",
        catalogKey: "1.21.1",
        components: { loader: "0.16.14" },
      }).status,
    ).toBe("matched");
    expect(
      resolveProfile([base], {
        platform: "fabric",
        catalogKey: "1.20.1",
        components: { loader: "0.16.14" },
      }).status,
    ).toBe("blocked");
    expect(
      resolveProfile([base, { ...base, id: "fabric-duplicate" }], {
        platform: "fabric",
        catalogKey: "1.21.1",
        components: { loader: "0.16.14" },
      }).status,
    ).toBe("ambiguous");
    expect(
      resolveProfile(
        [
          {
            ...base,
            catalog: {
              selectors: [
                {
                  ...baseSelector,
                  components: [
                    {
                      ...baseComponent,
                      mode: "all-components",
                    },
                  ],
                },
              ],
            },
          },
        ],
        {
          platform: "fabric",
          catalogKey: "1.21.1",
          components: { loader: "0.16.14" },
        },
      ).status,
    ).toBe("matched");
  });
});
