import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchResource, readBoundedBody } from "../src/fetch-resource.js";

const requestPolicy = {
  timeoutMs: 1_000,
  maxBytes: 1_024,
};

function source(id: string, url: string, expectedContentTypes: string[]) {
  return {
    id,
    role: "primary" as const,
    url,
    expectedContentTypes,
  };
}

const mojangSource = source(
  "mojang-version-manifest",
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  ["application/json"],
);
const forgeSource = source(
  "forge-maven-metadata",
  "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml",
  ["application/xml", "text/xml"],
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readBoundedBody", () => {
  it("reads a response within the byte limit", async () => {
    const bytes = await readBoundedBody(new Response("forge"), 5);
    expect(new TextDecoder().decode(bytes)).toBe("forge");
  });

  it("rejects a declared oversized response before reading", async () => {
    const response = new Response("forge", {
      headers: { "content-length": "6" },
    });
    await expect(readBoundedBody(response, 5)).rejects.toThrow(
      "source response exceeded 5 bytes",
    );
  });

  it("rejects a streamed response that crosses the byte limit", async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("for"));
          controller.enqueue(new TextEncoder().encode("ge"));
          controller.close();
        },
      }),
    );
    await expect(readBoundedBody(response, 4)).rejects.toThrow(
      "source response exceeded 4 bytes",
    );
  });
});

describe("fetchResource", () => {
  it("fetches an approved canonical source", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('{"versions":[]}', {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resource = await fetchResource(mojangSource, requestPolicy);

    expect(resource.record.url).toBe(
      "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    );
    expect(resource.record).toMatchObject({
      sourceId: "mojang-version-manifest",
      role: "primary",
      requestedUrl:
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      redirectChain: [
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      ],
    });
    expect(resource.text).toBe('{"versions":[]}');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(
      new URL(
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      ),
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("follows the approved forge maven redirect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location:
              "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/maven-metadata.xml",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response("<metadata />", {
          headers: { "content-type": "application/xml" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const resource = await fetchResource(forgeSource, requestPolicy);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toEqual(
      new URL(
        "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/maven-metadata.xml",
      ),
    );
    expect(resource.record.url).toBe(
      "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/maven-metadata.xml",
    );
  });

  it.each([
    "http://127.0.0.1/internal",
    "https://localhost/internal",
    "https://user:secret@piston-meta.mojang.com/mc/game/version_manifest_v2.json",
    "https://piston-meta.mojang.com:8443/mc/game/version_manifest_v2.json",
    "https://piston-meta.mojang.com/mc/game/other.json",
    "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json?target=internal",
  ])("rejects an undeclared initial url before fetching", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchResource({ ...mojangSource, url }, requestPolicy),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1/internal",
    "https://localhost/internal",
    "https://maven.minecraftforge.net/releases/net/minecraftforge/secret.xml",
  ])("rejects an undeclared redirect before fetching it", async (location) => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResource(forgeSource, requestPolicy)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a redirect without a location", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(new Response(null, { status: 302 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResource(forgeSource, requestPolicy)).rejects.toThrow(
      "source redirect omitted a location",
    );
  });

  it("rejects a redirect loop at the configured limit", async () => {
    let nextIsMaven = true;
    const fetchMock = vi.fn(() => {
      const location = nextIsMaven
        ? "https://maven.minecraftforge.net/releases/net/minecraftforge/forge/maven-metadata.xml"
        : "https://files.minecraftforge.net/maven/net/minecraftforge/forge/maven-metadata.xml";
      nextIsMaven = !nextIsMaven;
      return new Response(null, { status: 302, headers: { location } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResource(forgeSource, requestPolicy)).rejects.toThrow(
      "source exceeded the redirect limit",
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("rejects a response with an unexpected content type", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<html />", {
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchResource(mojangSource, requestPolicy)).rejects.toThrow(
      "source response content type is not approved for mojang-version-manifest",
    );
  });

  it("enforces the narrower media type declared by a source resource", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<metadata />", {
        headers: { "content-type": "application/xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchResource(
        {
          ...forgeSource,
          expectedContentTypes: ["text/xml"],
        },
        requestPolicy,
      ),
    ).rejects.toThrow(
      "source response content type is not approved for forge-maven-metadata",
    );
  });
});
