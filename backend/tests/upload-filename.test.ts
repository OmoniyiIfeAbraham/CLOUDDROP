import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { upload } from "../src/middleware/upload.middleware.js";

describe("Upload filename encoding", () => {
  it("preserves Unicode filenames", async () => {
    const app = express();

    app.post("/upload", upload.single("file"), (req, res) => {
      res.status(200).json({
        originalname: req.file?.originalname,
      });
    });

    const filename = "résumé_医学.pdf";

    const response = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("test file"), {
        filename,
        contentType: "application/pdf",
      });

    expect(response.status).toBe(200);
    expect(response.body.originalname).toBe(filename);
  });
});
