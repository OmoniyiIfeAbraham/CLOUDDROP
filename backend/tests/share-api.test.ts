import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/server.js";

describe("Public share links", () => {
  it("rejects a malformed share token without requiring authentication", async () => {
    const response = await request(app).get("/s/not-a-valid-token");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("SHARE_NOT_FOUND");
    expect(response.body.message).toBe(
      "This share link is invalid or no longer available",
    );
  });
});
