import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateRequest } from "../src/utils/validation.utils.js";

describe("Request validation", () => {
  it("should validate valid data", () => {
    const schema = z.object({
      email: z.string().email(),
    });

    const result = validateRequest(schema, {
      email: "test@example.com",
    });

    expect(result.email).toBe("test@example.com");
  });

  it("should reject invalid data", () => {
    const schema = z.object({
      email: z.string().email(),
    });

    expect(() =>
      validateRequest(schema, {
        email: "invalid-email",
      })
    ).toThrow();
  });
});
