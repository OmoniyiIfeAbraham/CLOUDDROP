import { describe, expect, it } from "vitest";
import { buildObjectKey } from "../src/lib/storage-key.js";

describe("Storage key", () => {
  it("scopes objects by user and file id", () => {
    expect(buildObjectKey("u1", "f1", "notes.pdf")).toBe(
      "users/u1/files/f1/notes.pdf"
    );
  });

  it("strips path separators from the original name", () => {
    expect(buildObjectKey("u1", "f1", "a/b\\c.pdf")).toBe(
      "users/u1/files/f1/a_b_c.pdf"
    );
  });
});
