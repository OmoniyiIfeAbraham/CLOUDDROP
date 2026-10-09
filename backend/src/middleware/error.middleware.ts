import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds the 25 MB limit",
        error: {
          code: "FILE_TOO_LARGE",
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid file upload",
      error: {
        code: "INVALID_FILE_UPLOAD",
      },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: {
      code: "INTERNAL_SERVER_ERROR",
    },
  });
};
