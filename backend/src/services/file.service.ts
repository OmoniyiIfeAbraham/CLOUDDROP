import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { deleteFromS3 } from "./s3-delete.service.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export const createFile = async (
  userId: string,
  originalName: string,
  s3Key: string,
  mimeType: string,
  size: number,
  category:
    | "Documents"
    | "Images"
    | "Videos"
    | "Audio"
    | "Archives"
    | "Other",
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
