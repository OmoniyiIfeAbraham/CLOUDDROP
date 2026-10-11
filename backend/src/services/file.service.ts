import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { deleteFromS3 } from "./s3-delete.service.js";

const databaseUrl = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL)
  : null;

databaseUrl?.searchParams.delete("sslmode");

const poolConfig = {
  ...(databaseUrl
    ? { connectionString: databaseUrl.toString() }
    : {}),
  ...(process.env.NODE_ENV === "production"
    ? {
        ssl: {
          ca: readFileSync(
            "/etc/ssl/certs/rds-eu-west-1-bundle.pem",
            "utf8",
          ),
          rejectUnauthorized: true,
        },
      }
    : {}),
};

const adapter = new PrismaPg(poolConfig);
const prisma = new PrismaClient({ adapter });

type FileCategory =
  | "Documents"
  | "Images"
  | "Videos"
  | "Audio"
  | "Archives"
  | "Other";

interface ListUserFilesOptions {
  search?: string;
  category?: FileCategory | undefined;
  page?: number;
  limit?: number;
}

export const createFile = async (
  userId: string,
  originalName: string,
  s3Key: string,
  mimeType: string,
  size: number,
  category: FileCategory,
) => {
  return prisma.file.create({
    data: {
      userId,
      originalName,
      s3Key,
      mimeType,
      size,
      category,
    },
  });
};

export const getUserFiles = async (userId: string) => {
  return prisma.file.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const getFileById = async (fileId: string, userId: string) => {
  return prisma.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });
};

export const deleteFile = async (fileId: string, userId: string) => {
  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      userId,
    },
  });

  if (!file) {
    return null;
  }

  await deleteFromS3(file.s3Key);

  return prisma.file.delete({
    where: {
      id: fileId,
    },
  });
};

export const searchUserFiles = async (
  userId: string,
  search: string,
) => {
  return prisma.file.findMany({
    where: {
      userId,
      originalName: {
        contains: search,
        mode: "insensitive",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

export const listUserFiles = async (
  userId: string,
  options: ListUserFilesOptions = {},
) => {
  const {
    search = "",
    category,
    page = 1,
    limit = 10,
  } = options;

  const where = {
    userId,
    ...(search
      ? {
          originalName: {
            contains: search,
            mode: "insensitive" as const,
          },
        }
      : {}),
    ...(category ? { category } : {}),
  };

  const skip = (page - 1) * limit;

  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: limit,
    }),

    prisma.file.count({
      where,
    }),
  ]);

  return {
    files,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
