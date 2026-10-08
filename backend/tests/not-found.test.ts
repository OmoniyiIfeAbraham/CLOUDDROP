import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/server.js";

describe("Not found handler", () => {
  it("should return a 404 response for an unknown route", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Route not found");
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
