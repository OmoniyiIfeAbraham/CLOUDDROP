import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/server.js";
import { generateToken } from "../src/utils/auth.utils.js";

const token = generateToken("validation-test-user");

describe("Files API validation", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await request(app).get("/api/v1/files");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("accepts an authenticated request with default pagination", async () => {
    const response = await request(app)
      .get("/api/v1/files")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it("rejects an invalid page", async () => {
    const response = await request(app)
      .get("/api/v1/files?page=0")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Page must be a positive integer");
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects a limit greater than 100", async () => {
    const response = await request(app)
      .get("/api/v1/files?limit=101")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      "Limit must be an integer between 1 and 100",
    );
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("rejects an invalid file category", async () => {
    const response = await request(app)
      .get("/api/v1/files?category=InvalidCategory")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid file category");
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("accepts a valid category filter", async () => {
    const response = await request(app)
      .get("/api/v1/files?category=Documents")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(10);
  });

  it("accepts search with pagination", async () => {
    const response = await request(app)
      .get("/api/v1/files?search=report&page=1&limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });
});
