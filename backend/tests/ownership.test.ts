import { describe, expect, it } from "vitest";
import { ApiError } from "../src/utils/api-error.js";
import { assertFileOwner, getRequesterId } from "../src/services/files.service.js";

describe("File ownership", () => {
  it("allows the owner to access the file", () => {
    expect(() => assertFileOwner("user-1", "user-1")).not.toThrow();
  });

  it("blocks access to another user's file", () => {
    try {
      assertFileOwner("user-1", "user-2");
      throw new Error("expected assertFileOwner to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(403);
      expect((error as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("requires an authenticated user id", () => {
    try {
      getRequesterId(undefined);
      throw new Error("expected getRequesterId to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(401);
    }
  });
});
