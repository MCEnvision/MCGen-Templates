import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SourceDefinition } from "./contracts.js";
import {
  createSchemaRegistry,
  repositoryRoot,
  validateWithSchema,
} from "./schema-registry.js";

export async function loadSourceDefinition(
  id: string,
): Promise<SourceDefinition> {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(id)) {
    throw new Error("source definition id is invalid");
  }
  const path = resolve(repositoryRoot, "sources", "definitions", `${id}.json`);
  const document = JSON.parse(await readFile(path, "utf8")) as unknown;
  const result = validateWithSchema(await createSchemaRegistry(), document);
  if (!result.valid) {
    throw new Error(
      `source definition ${id} is invalid\n${result.errors
        .map(
          (error) =>
            `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
        )
        .join("\n")}`,
    );
  }
  return document as SourceDefinition;
}
