import type { Request, Response } from "express";
import { validateRequest } from "../utils/validation.utils.js";
import { fileCategorySchema } from "../utils/file.validation.js";
import { uploadToS3 } from "../services/s3.service.js";
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

  res.status(200).json({
    success: true,
    message: "File uploaded to S3 successfully",
    data: {
      file: {
        id: fileId,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category,
        s3Key: uploadedFile.key,
      },
    },
  });
};
