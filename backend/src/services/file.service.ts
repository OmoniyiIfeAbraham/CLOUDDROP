import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

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
