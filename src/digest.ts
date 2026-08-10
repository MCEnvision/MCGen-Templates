import { createHash } from "node:crypto";

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sha512(value: string | Uint8Array): string {
  return createHash("sha512").update(value).digest("hex");
}
