import { sha256 } from "./digest.js";
import type { FetchedResource, SourceRecord } from "./contracts.js";
import {
  resolveCanonicalSourceUrl,
  sourceRedirectLimit,
  type CanonicalSourceId,
} from "./source-network-policy.js";

export type FetchPolicy = {
  timeoutMs: number;
  maxBytes: number;
};

export async function readBoundedBody(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    throw new Error(`source response exceeded ${maxBytes} bytes`);
  }
  if (!response.body) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("source response exceeded configured byte limit");
        throw new Error(`source response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchResource(
  sourceId: CanonicalSourceId,
  url: string,
  policy: FetchPolicy,
): Promise<FetchedResource> {
  const signal = AbortSignal.timeout(policy.timeoutMs);
  const maxRedirects = sourceRedirectLimit(sourceId);
  let currentUrl = resolveCanonicalSourceUrl(sourceId, url);
  let redirects = 0;
  let response: Response;
  for (;;) {
    response = await fetch(currentUrl, {
      headers: {
        accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.1",
        "user-agent": "mcgen-template-snapshot/1.0",
      },
      redirect: "manual",
      signal,
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      break;
    }
    if (redirects >= maxRedirects) {
      throw new Error(`source exceeded the redirect limit for ${sourceId}`);
    }
    const location = response.headers.get("location");
    if (!location) {
      throw new Error(`source redirect omitted a location for ${sourceId}`);
    }
    await response.body?.cancel();
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(location, currentUrl);
    } catch {
      throw new Error(`source redirect location is invalid for ${sourceId}`);
    }
    currentUrl = resolveCanonicalSourceUrl(sourceId, redirectUrl.href);
    redirects += 1;
  }
  if (!response.ok) {
    throw new Error(
      `source request failed with http ${response.status} for ${sourceId}`,
    );
  }
  const bytes = await readBoundedBody(response, policy.maxBytes);
  if (bytes.byteLength === 0) {
    throw new Error(`source returned an empty response for ${sourceId}`);
  }
  const contentType = response.headers.get("content-type")?.trim();
  if (!contentType) {
    throw new Error(`source response omitted content type for ${sourceId}`);
  }
  const record: SourceRecord = {
    url: currentUrl.href,
    retrievedAt: new Date().toISOString(),
    contentType,
    sha256: sha256(bytes),
    bytes: bytes.byteLength,
  };
  const etag = response.headers.get("etag")?.trim();
  const lastModified = response.headers.get("last-modified")?.trim();
  if (etag) {
    record.etag = etag;
  }
  if (lastModified) {
    record.lastModified = lastModified;
  }
  return {
    record,
    text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  };
}
