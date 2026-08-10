import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";
import { renderTemplate } from "../src/template-renderer.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "../src/schema-registry.js";
import { validatePng } from "../src/png.js";
import {
  switchProjectMode,
  validateProjectSpec,
  type ProjectSpec,
} from "../src/project-spec.js";

type JsonObject = Record<string, unknown>;

const expectedDescriptorIds = new Set([
  "architectury",
  "bukkit",
  "bungeecord",
  "fabric",
  "forge",
  "multiloader",
  "neoforge",
  "paper-modern",
  "paper-traditional",
  "spigot",
  "sponge",
  "velocity",
]);

const png = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fixture document must be an object");
  }
  return value as JsonObject;
}

async function json(path: string): Promise<JsonObject> {
  return object(JSON.parse(await readFile(path, "utf8")) as unknown);
}

async function descriptorFiles(): Promise<string[]> {
  const directories = await readdir(resolve(repositoryRoot, "templates"), {
    withFileTypes: true,
  });
  const paths: string[] = [];
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const files = await readdir(
      resolve(repositoryRoot, "templates", directory.name),
      { withFileTypes: true },
    );
    for (const file of files) {
      if (file.isFile() && file.name.startsWith("descriptor")) {
        paths.push(
          resolve(repositoryRoot, "templates", directory.name, file.name),
        );
      }
    }
  }
  return paths.sort();
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}

function itemCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function descriptorField(
  descriptor: JsonObject,
  modern: string,
  legacy: string,
): unknown {
  return descriptor[modern] ?? descriptor[legacy];
}

describe("phase 4 fixture contracts", () => {
  it("covers every planned template family with a descriptor boundary", async () => {
    const paths = await descriptorFiles();
    const descriptors = await Promise.all(paths.map(json));
    expect(new Set(descriptors.map((descriptor) => descriptor["id"]))).toEqual(
      expectedDescriptorIds,
    );

    for (const descriptor of descriptors) {
      expect(descriptor["status"]).toMatch(/^(reviewed|blocked)$/);
      expect(itemCount(descriptor["platforms"])).toBeGreaterThan(0);
      expect(itemCount(descriptor["capabilities"])).toBeGreaterThan(0);
      expect(
        asArray(descriptorField(descriptor, "fields", "properties")).length,
      ).toBeGreaterThan(0);
      expect(asArray(descriptor["files"]).length).toBeGreaterThan(0);
      expect(
        asArray(descriptorField(descriptor, "metadataTargets", "renderTargets"))
          .length,
      ).toBeGreaterThan(0);
      expect(asArray(descriptor["assetSlots"]).length).toBeGreaterThan(0);

      const fields = asArray(
        descriptorField(descriptor, "fields", "properties"),
      );
      for (const field of fields) {
        expect(field["id"]).toEqual(expect.any(String));
        expect(field["modes"]).toEqual(
          expect.arrayContaining(["simple", "advanced"]),
        );
      }
      for (const slot of asArray(descriptor["assetSlots"])) {
        expect(slot["mediaTypes"]).toEqual(["image/png"]);
      }
      if (descriptor["status"] === "blocked") {
        expect(asArray(descriptor["blockers"]).length).toBeGreaterThan(0);
      }
    }
  });

  it("keeps project fixtures schema valid across both modes and release channels", async () => {
    const directory = resolve(repositoryRoot, "fixtures", "phase4");
    const files = (await readdir(directory))
      .filter(
        (file) => file.startsWith("project-spec-") && file.endsWith(".json"),
      )
      .sort();
    expect(files).toHaveLength(4);
    expect(files).toEqual([
      "project-spec-advanced-beta.json",
      "project-spec-advanced-snapshot.json",
      "project-spec-simple-alpha.json",
      "project-spec-simple-rc.json",
    ]);

    const registry = await createSchemaRegistry();
    const versions = new Set<string>();
    const modes = new Set<string>();
    for (const file of files) {
      const fixture = await json(resolve(directory, file));
      const result = validateWithSchema(registry, fixture);
      expect(result.valid, `${file}: ${JSON.stringify(result.errors)}`).toBe(
        true,
      );
      expect(validateProjectSpec(fixture)).toEqual([]);
      const project = object(fixture["project"]);
      versions.add(String(project["version"]));
      modes.add(String(fixture["mode"]));

      const asset = object(asArray(fixture["assets"])[0]);
      const info = validatePng(png);
      expect(asset["mediaType"]).toBe("image/png");
      expect(asset["sha256"]).toBe(info.sha256);
      expect(asset["bytes"]).toBe(info.bytes);
      expect(asset["width"]).toBe(info.width);
      expect(asset["height"]).toBe(info.height);
      expect(asset["alpha"]).toBe(info.hasAlpha);
    }
    expect(versions).toEqual(
      new Set(["1.0-alpha.1", "1.0-beta.1", "1.0-rc.1", "1.0-SNAPSHOT"]),
    );
    expect(modes).toEqual(new Set(["simple", "advanced"]));
  });

  it("renders each fixture deterministically and preserves dormant mode values", async () => {
    const directory = resolve(repositoryRoot, "fixtures", "phase4");
    const files = (await readdir(directory))
      .filter(
        (file) => file.startsWith("project-spec-") && file.endsWith(".json"),
      )
      .sort();
    for (const file of files) {
      const spec = (await json(
        resolve(directory, file),
      )) as unknown as ProjectSpec;
      const request = {
        descriptorId: "fixture",
        spec,
        files: [
          {
            path: "README.md",
            content: "# ${project.name}\nversion ${project.version}\n",
          },
          {
            path: "src/main/java/FixtureMod.java",
            content: "class FixtureMod {}\n",
          },
        ],
        metadata: [
          {
            path: "src/main/resources/metadata.json",
            format: "json" as const,
            value: { id: "${project.id}", version: "${project.version}" },
          },
        ],
      };
      const first = renderTemplate(request);
      const second = renderTemplate({
        ...request,
        files: [...request.files].reverse(),
      });
      expect(first.treeDigest).toBe(second.treeDigest);
      expect(canonicalJson([...first.files.keys()])).toBe(
        canonicalJson([...second.files.keys()]),
      );
      expect(new TextDecoder().decode(first.files.get("README.md"))).toContain(
        spec.project.version,
      );

      const otherMode = spec.mode === "simple" ? "advanced" : "simple";
      const switched = switchProjectMode(spec, otherMode);
      expect(switched.project.version).toBe(spec.project.version);
      expect(switched.project.id).toBe(spec.project.id);
      if (spec.mode === "advanced") {
        expect(switched.dormant?.["advanced"]).toEqual(spec.build);
      }
    }
  });
});
