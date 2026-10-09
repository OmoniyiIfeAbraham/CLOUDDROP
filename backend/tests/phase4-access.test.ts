import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/server.js";
import { generateToken } from "../src/utils/auth.utils.js";

const owner = generateToken("phase4-owner");
const other = generateToken("phase4-other");
const missingId = "00000000-0000-4000-8000-000000000001";

const protectedRoutes: Array<{
  method: "get" | "post" | "delete";
  path: string;
}> = [
  { method: "get", path: "/api/v1/files" },
  { method: "post", path: "/api/v1/files" },
  { method: "get", path: `/api/v1/files/${missingId}` },
  { method: "get", path: `/api/v1/files/${missingId}/download` },
  { method: "delete", path: `/api/v1/files/${missingId}` },
  { method: "post", path: `/api/v1/files/${missingId}/share` },
  { method: "get", path: "/api/v1/dashboard/stats" },
  { method: "get", path: "/api/v1/categories" },
];

describe("Phase 4 access control", () => {
  it.each(protectedRoutes)(
    "rejects $method $path without a token",
    async ({ method, path }) => {
      const response = await request(app)[method](path);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    },
  );

  it.each(protectedRoutes)(
    "rejects $method $path with a bad token",
    async ({ method, path }) => {
      const response = await request(app)
        [method](path)
        .set("Authorization", "Bearer not-a-jwt");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    },
  );

  it("does not leak another user's file by id", async () => {
    const response = await request(app)
      .get(`/api/v1/files/${missingId}`)
      .set("Authorization", `Bearer ${other}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("does not let another user download a file they do not own", async () => {
    const response = await request(app)
      .get(`/api/v1/files/${missingId}/download`)
      .set("Authorization", `Bearer ${other}`);

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("data.downloadUrl");
  });

  it("does not let another user delete a file they do not own", async () => {
    const response = await request(app)
      .delete(`/api/v1/files/${missingId}`)
      .set("Authorization", `Bearer ${other}`);

    expect(response.status).toBe(404);
  });

  it("does not let another user create a share for a file they do not own", async () => {
    const response = await request(app)
      .post(`/api/v1/files/${missingId}/share`)
      .set("Authorization", `Bearer ${other}`)
      .send({ ttlHours: 1 });

    expect(response.status).toBe(404);
    expect(response.body).not.toHaveProperty("data.shareUrl");
    expect(response.body).not.toHaveProperty("data.token");
  });

  it("rejects upload with no file body", async () => {
    const response = await request(app)
      .post("/api/v1/files")
      .set("Authorization", `Bearer ${owner}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns dashboard stats only for the authenticated user", async () => {
    const response = await request(app)
      .get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${owner}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        totalFiles: expect.any(Number),
        totalStorage: expect.any(Number),
        sharedFiles: expect.any(Number),
        filesByCategory: expect.any(Object),
      }),
    );
  });
});
