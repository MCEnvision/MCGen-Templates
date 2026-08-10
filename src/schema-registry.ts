import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import * as formatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaDirectory = resolve(repositoryRoot, "schemas");
const addFormats = formatsModule.default as unknown as FormatsPlugin;

export type ValidationResult = {
  valid: boolean;
  errors: ErrorObject[];
};

export async function createSchemaRegistry(): Promise<Ajv2020> {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const names = (await readdir(schemaDirectory))
    .filter((name) => name.endsWith(".schema.json"))
    .sort((left, right) => left.localeCompare(right));
  for (const name of names) {
    const schema = JSON.parse(
      await readFile(resolve(schemaDirectory, name), "utf8"),
    ) as object;
    ajv.addSchema(schema);
  }
  return ajv;
}

export function validateWithSchema(
  ajv: Ajv2020,
  document: unknown,
): ValidationResult {
  if (
    document === null ||
    typeof document !== "object" ||
    !("$schema" in document) ||
    typeof document.$schema !== "string"
  ) {
    return {
      valid: false,
      errors: [
        {
          instancePath: "",
          schemaPath: "#/$schema",
          keyword: "$schema",
          params: {},
          message: "must identify a registered mcgen schema",
        },
      ],
    };
  }
  const validate = ajv.getSchema(document.$schema) as
    ValidateFunction | undefined;
  if (!validate) {
    return {
      valid: false,
      errors: [
        {
          instancePath: "/$schema",
          schemaPath: "#/$schema",
          keyword: "$schema",
          params: { value: document.$schema },
          message: "is not a registered mcgen schema",
        },
      ],
    };
  }
  const valid = validate(document);
  if (typeof valid !== "boolean") {
    throw new Error("asynchronous schemas are not supported");
  }
  return {
    valid,
    errors: validate.errors ?? [],
  };
}

export { repositoryRoot };
