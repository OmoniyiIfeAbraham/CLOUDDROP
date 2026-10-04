import type { Request, Response } from "express";
import { validateRequest } from "../utils/validation.utils.js";
import { fileCategorySchema } from "../utils/file.validation.js";

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

  res.status(200).json({
    success: true,
    message: "File received successfully",
    data: {
      file: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        category,
      },
    },
  });
};
