import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";

describe("canonicalJson", () => {
  it("sorts object keys without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 }, items: ["z", "a"] })).toBe(
      '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "items": [\n    "z",\n    "a"\n  ],\n  "z": 1\n}\n',
    );
  });
});
