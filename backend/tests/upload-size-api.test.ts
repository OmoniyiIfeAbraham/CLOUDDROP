import request from "supertest";
import { vi, describe, expect, it } from "vitest";
import app from "../src/server.js";
import { generateToken } from "../src/utils/auth.utils.js";


vi.mock("../src/services/auth.service.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/auth.service.js")>();

  return {
    ...actual,
    getTokenVersionForAuth: vi.fn().mockResolvedValue(0),
  };
});

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

describe("Upload category validation", () => {
  it("returns 400 for an invalid category before storing the file", async () => {
    const token = generateToken("invalid-category-test-user");

    const response = await request(app)
      .post("/api/v1/files")
      .set("Authorization", `Bearer ${token}`)
      .field("category", "InvalidCategory")
      .attach("file", Buffer.from("test file"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid file category");
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 when the category is missing", async () => {
    const token = generateToken("missing-category-test-user");

    const response = await request(app)
      .post("/api/v1/files")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("test file"), {
        filename: "test.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid file category");
    expect(response.body.error.code).toBe("BAD_REQUEST");
  });
});
