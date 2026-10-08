import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export const getDashboardStats = async (userId: string) => {
  const [totalFiles, storageResult, sharedFiles, categoryCounts] =
    await Promise.all([
      prisma.file.count({
        where: { userId },
      }),

      prisma.file.aggregate({
        where: { userId },
        _sum: {
          size: true,
        },
      }),

      prisma.share.count({
        where: {
          file: {
            userId,
          },
        },
      }),

      prisma.file.groupBy({
        by: ["category"],
        where: { userId },
        _count: {
          category: true,
        },
      }),
    ]);

  const filesByCategory = {
    Documents: 0,
    Images: 0,
    Videos: 0,
    Audio: 0,
    Archives: 0,
    Other: 0,
  };

  for (const item of categoryCounts) {
    filesByCategory[item.category] = item._count.category;
  }

  return {
    totalFiles,
    totalStorage: storageResult._sum.size ?? 0,
    sharedFiles,
    filesByCategory,
  };
};
