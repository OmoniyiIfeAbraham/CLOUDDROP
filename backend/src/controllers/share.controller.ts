import type { Request, Response } from "express";
import { getFileById } from "../services/file.service.js";
import { generateShareUrl } from "../services/s3-share.service.js";

interface AuthRequest extends Request {
  userId?: string;
}

export const shareFile = async (
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

  const id = req.params.id as string;

  if (!id) {
    res.status(400).json({
      success: false,
      message: "File ID is required",
      error: {
        code: "BAD_REQUEST",
      },
    });
    return;
  }

  const file = await getFileById(id, req.userId);

  if (!file) {
    res.status(404).json({
      success: false,
      message: "File not found",
      error: {
        code: "NOT_FOUND",
      },
    });
    return;
  }

  const shareUrl = await generateShareUrl(file.s3Key);

  res.status(200).json({
    success: true,
    message: "Share URL generated successfully",
    data: {
      file: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
      },
      shareUrl,
      expiresIn: 3600,
    },
  });
};
