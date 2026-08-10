import { describe, expect, it } from "vitest";
import { readBoundedBody } from "../src/fetch-resource.js";

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
