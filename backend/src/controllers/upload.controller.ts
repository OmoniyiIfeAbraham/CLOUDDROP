import type { Request, Response } from "express";
import { validateRequest } from "../utils/validation.utils.js";
import { fileCategorySchema } from "../utils/file.validation.js";
import { uploadToS3 } from "../services/s3.service.js";
import { createFile } from "../services/file.service.js";
import crypto from "crypto";

interface AuthRequest extends Request {
  userId?: string;
}

export const uploadFile = async (
  req: AuthRequest,
  res: Response,
) => {
  if (!req.userId) {
    res.status(401).json({
      success: false,
      message: "Authentication required",
      error: {
        code: "UNAUTHORIZED",
      },
    });
    return;
  }

  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "File is required",
      error: {
        code: "BAD_REQUEST",
      },
    });
    return;
  }

  const { category } = validateRequest(
    fileCategorySchema,
    req.body,
  );

  const fileId = crypto.randomUUID();

  const s3Key = `${req.userId}/${fileId}-${req.file.originalname}`;

  const uploadedFile = await uploadToS3(
    req.file.buffer,
    s3Key,
    req.file.mimetype,
  );

  const savedFile = await createFile(
    req.userId,
    req.file.originalname,
    uploadedFile.key,
    req.file.mimetype,
    req.file.size,
    category,
  );

  res.status(201).json({
    success: true,
    message: "File uploaded successfully",
    data: {
      file: savedFile,
    },
  });
};
