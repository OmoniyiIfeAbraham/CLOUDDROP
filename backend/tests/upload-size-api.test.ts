import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/server.js";
import { generateToken } from "../src/utils/auth.utils.js";

describe("Upload size limit", () => {
  it("returns 400 when an uploaded file exceeds 25 MB", async () => {
    const token = generateToken("upload-size-test-user");
    const oversizedFile = Buffer.alloc(25 * 1024 * 1024 + 1);

    const response = await request(app)
      .post("/api/v1/files")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", oversizedFile, {
        filename: "oversized.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("File size exceeds the 25 MB limit");
    expect(response.body.error.code).toBe("FILE_TOO_LARGE");
  }, 60000);
});
