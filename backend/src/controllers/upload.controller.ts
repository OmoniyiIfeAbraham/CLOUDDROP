import type { Request, Response } from "express";
import { validateRequest } from "../utils/validation.utils.js";
import { fileCategorySchema } from "../utils/file.validation.js";
import { validateUploadedFile } from "../utils/file-upload.validation.js";
import { uploadToS3 } from "../services/s3.service.js";
import { deleteFromS3 } from "../services/s3-delete.service.js";
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

  try {
    validateUploadedFile(
      req.file.mimetype,
      req.file.size,
    );

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

    try {
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
    } catch {
      await deleteFromS3(uploadedFile.key);

      res.status(500).json({
        success: false,
        message: "File metadata could not be saved",
        error: {
          code: "DATABASE_ERROR",
        },
      });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "File size exceeds the 100 MB limit"
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: {
          code: "FILE_TOO_LARGE",
        },
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message === "File type is not supported"
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: {
          code: "UNSUPPORTED_FILE_TYPE",
        },
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: "Invalid upload request",
      error: {
        code: "INVALID_UPLOAD",
      },
    });
  }
};
