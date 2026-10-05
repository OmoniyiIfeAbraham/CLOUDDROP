import type { Request, Response } from "express";
import {
  getUserFiles,
  getFileById,
  deleteFile,
  searchUserFiles,
} from "../services/file.service.js";

interface AuthRequest extends Request {
  userId?: string;
}

export const getFiles = async (req: AuthRequest, res: Response) => {
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

  try {
    const files = await getUserFiles(req.userId);

    res.status(200).json({
      success: true,
      message: "Files retrieved successfully",
      data: {
        files,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "Files could not be retrieved",
      error: {
        code: "FILES_RETRIEVAL_FAILED",
      },
    });
  }
};

export const searchFiles = async (req: AuthRequest, res: Response) => {
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

  const search = req.query.search as string;

  if (!search || !search.trim()) {
    res.status(400).json({
      success: false,
      message: "Search query is required",
      error: {
        code: "BAD_REQUEST",
      },
    });
    return;
  }

  try {
    const files = await searchUserFiles(req.userId, search.trim());

    res.status(200).json({
      success: true,
      message: "Files search completed successfully",
      data: {
        files,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "File search failed",
      error: {
        code: "SEARCH_FAILED",
      },
    });
  }
};

export const getFile = async (req: AuthRequest, res: Response) => {
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

  try {
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

    res.status(200).json({
      success: true,
      message: "File retrieved successfully",
      data: {
        file,
      },
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "File could not be retrieved",
      error: {
        code: "FILE_RETRIEVAL_FAILED",
      },
    });
  }
};

export const removeFile = async (req: AuthRequest, res: Response) => {
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

  try {
    const file = await deleteFile(id, req.userId);

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

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch {
    res.status(500).json({
      success: false,
      message: "File could not be deleted",
      error: {
        code: "DELETE_FAILED",
      },
    });
  }
};
