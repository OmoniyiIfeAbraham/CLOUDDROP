import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { ApiError } from "../utils/api-error.js";
import { validateRequest } from "../utils/validation.utils.js";
import { fileCategorySchema } from "../utils/file.validation.js";
import { validateUploadedFile } from "../utils/file-upload.validation.js";
import { buildObjectKey } from "../lib/storage-key.js";
import {
  createShareToken,
  resolveShareExpiry,
  DEFAULT_SHARE_TTL_HOURS,
} from "../lib/share-policy.js";
import { uploadToS3 } from "../services/s3.service.js";
import { deleteFromS3 } from "../services/s3-delete.service.js";
import { generateDownloadUrl } from "../services/s3-download.service.js";
import { generateShareUrl } from "../services/s3-share.service.js";
import {
  createFile,
  getFileById,
  deleteFile as deleteFileRecord,
  listUserFiles,
} from "../services/file.service.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.delete("sslmode");

const poolConfig = {
  connectionString: databaseUrl.toString(),
  ...(process.env.NODE_ENV === "production"
    ? {
        ssl: {
          ca: readFileSync("/etc/ssl/certs/rds-eu-west-1-bundle.pem", "utf8"),
          rejectUnauthorized: true,
        },
      }
    : {}),
};

const adapter = new PrismaPg(poolConfig);

const prisma = new PrismaClient({ adapter });

const getUserId = (req: Request): string => {
  const userId =
    req.user?.id ?? (req as Request & { userId?: string }).userId;

  if (!userId) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  return userId;
};

export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);

    if (!req.file) {
      throw new ApiError(400, "File is required", "BAD_REQUEST");
    }

    validateUploadedFile(req.file.mimetype, req.file.size);

    const { category } = validateRequest(fileCategorySchema, req.body);

    const fileId = crypto.randomUUID();
    const s3Key = buildObjectKey(userId, fileId, req.file.originalname);

    const uploaded = await uploadToS3(
      req.file.buffer,
      s3Key,
      req.file.mimetype,
    );

    try {
      const savedFile = await createFile(
        userId,
        req.file.originalname,
        uploaded.key,
        req.file.mimetype,
        req.file.size,
        category,
      );

      res.status(201).json({
        success: true,
        message: "File uploaded successfully",
        data: { file: savedFile },
      });
    } catch {
      // Roll back S3 object if metadata save fails
      await deleteFromS3(uploaded.key).catch(() => undefined);

      throw new ApiError(
        500,
        "File metadata could not be saved",
        "DATABASE_ERROR",
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "File size exceeds the 2 GB limit") {
        return next(
          new ApiError(400, error.message, "FILE_TOO_LARGE"),
        );
      }

      if (error.message === "File type is not supported") {
        return next(
          new ApiError(400, error.message, "UNSUPPORTED_FILE_TYPE"),
        );
      }
    }

    next(error);
  }
};

export const listFiles = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : undefined;

    const pageParam =
      typeof req.query.page === "string"
        ? Number(req.query.page)
        : 1;

    const limitParam =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : 10;

    if (!Number.isInteger(pageParam) || pageParam < 1) {
      throw new ApiError(
        400,
        "Page must be a positive integer",
        "BAD_REQUEST",
      );
    }

    if (
      !Number.isInteger(limitParam) ||
      limitParam < 1 ||
      limitParam > 100
    ) {
      throw new ApiError(
        400,
        "Limit must be an integer between 1 and 100",
        "BAD_REQUEST",
      );
    }

    let validatedCategory:
      | "Documents"
      | "Images"
      | "Videos"
      | "Audio"
      | "Archives"
      | "Other"
      | undefined;

    if (category) {
      const result = fileCategorySchema.safeParse({ category });

      if (!result.success) {
        throw new ApiError(
          400,
          "Invalid file category",
          "BAD_REQUEST",
        );
      }

      validatedCategory = result.data.category;
    }

    const result = await listUserFiles(userId, {
      search,
      category: validatedCategory,
      page: pageParam,
      limit: limitParam,
    });

    return res.status(200).json({
      success: true,
      message: "Files retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);

    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      message: "File retrieved successfully",
      data: { file },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);

    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    const expiresIn = 600;
    const downloadUrl = await generateDownloadUrl(file.s3Key, expiresIn);

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
        expiresIn,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const deleted = await deleteFileRecord(id, userId);

    if (!deleted) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const createShare = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    if (!id) {
      throw new ApiError(400, "File ID is required", "BAD_REQUEST");
    }

    const file = await getFileById(id, userId);

    if (!file) {
      throw new ApiError(404, "File not found", "NOT_FOUND");
    }

    const ttlHours =
      typeof req.body?.ttlHours === "number"
        ? req.body.ttlHours
        : DEFAULT_SHARE_TTL_HOURS;

    let expiresAt: Date;

    try {
      expiresAt = resolveShareExpiry(ttlHours);
    } catch (err) {
      throw new ApiError(
        400,
        err instanceof Error ? err.message : "Invalid share TTL",
        "BAD_REQUEST",
      );
    }

    const token = createShareToken();

    await prisma.share.create({
      data: {
        fileId: file.id,
        token,
        expiresAt,
      },
    });

    const expiresInSeconds = Math.min(
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      7 * 24 * 60 * 60,
    );

    const shareUrl = await generateShareUrl(
      file.s3Key,
      expiresInSeconds,
    );

    res.status(201).json({
      success: true,
      message: "Share URL generated successfully",
      data: {
        file: {
          id: file.id,
          originalName: file.originalName,
          mimeType: file.mimeType,
        },
        token,
        shareUrl,
        expiresAt: expiresAt.toISOString(),
        expiresIn: expiresInSeconds,
      },
    });
  } catch (error) {
    next(error);
  }
};
