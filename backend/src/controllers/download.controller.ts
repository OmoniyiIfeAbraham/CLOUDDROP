import type { Request, Response } from "express";
import { getFileById } from "../services/file.service.js";
import { generateDownloadUrl } from "../services/s3-download.service.js";

interface AuthRequest extends Request {
  userId?: string;
}

export const downloadFile = async (
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

  const downloadUrl = await generateDownloadUrl(file.s3Key);

  res.status(200).json({
    success: true,
    message: "File download URL generated successfully",
    data: {
      file: {
        id: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
      },
      downloadUrl,
      expiresIn: 300,
    },
  });
};
