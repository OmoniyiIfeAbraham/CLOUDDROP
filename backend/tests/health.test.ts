import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/server.js";

describe("Health check", () => {
  it("should return a successful response", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("CloudDrop API is running");
  });
});
