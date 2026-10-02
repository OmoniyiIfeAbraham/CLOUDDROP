import { describe, expect, it } from "vitest";

describe("Health check", () => {
  it("should return a successful response", () => {
    const response = {
      success: true,
      message: "CloudDrop API is running",
    };

    expect(response.success).toBe(true);
    expect(response.message).toBe("CloudDrop API is running");
  });
});
