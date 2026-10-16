import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/utils/api-error.js";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  deleteFile: vi.fn(),
  deleteUser: vi.fn(),
  deleteFromS3: vi.fn(),
}));

vi.mock("../src/generated/prisma/client.js", () => ({
  PrismaClient: class {
    user = {
      findUnique: mocks.findUnique,
      delete: mocks.deleteUser,
    };

    file = {
      findMany: mocks.findMany,
      delete: mocks.deleteFile,
    };
  },
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(),
}));

vi.mock("../src/services/s3-delete.service.js", () => ({
  deleteFromS3: mocks.deleteFromS3,
}));

describe("deleteAccount service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://test:test@localhost:5432/cloud_drop_test",
    );
    vi.stubEnv("NODE_ENV", "test");
    mocks.deleteFile.mockResolvedValue({ id: "file-1" });
  });

  it("returns 404 when the user does not exist", async () => {
    mocks.findUnique.mockResolvedValue(null);

    vi.resetModules();
    const { deleteAccount } = await import("../src/services/auth.service.js");

    await expect(deleteAccount("missing-user")).rejects.toMatchObject({
      statusCode: 404,
      code: "USER_NOT_FOUND",
    });

    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.deleteFromS3).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes stored files before deleting the user", async () => {
    const order: string[] = [];

    mocks.findUnique.mockResolvedValue({ id: "user-1" });
    mocks.findMany.mockResolvedValue([
      { id: "file-1", s3Key: "uploads/file-one.pdf" },
      { id: "file-2", s3Key: "uploads/file-two.png" },
    ]);
    mocks.deleteFromS3.mockImplementation(async () => {
      order.push("s3");
    });
    mocks.deleteFile.mockImplementation(async ({ where }) => {
      order.push(`db:${where.id}`);
      return { id: where.id };
    });
    mocks.deleteUser.mockImplementation(async () => {
      order.push("user");
      return { id: "user-1" };
    });

    vi.resetModules();
    const { deleteAccount } = await import("../src/services/auth.service.js");

    await expect(deleteAccount("user-1")).resolves.toEqual({
      message: "Account deleted successfully",
    });

    expect(mocks.deleteFromS3).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFromS3).toHaveBeenNthCalledWith(
      1,
      "uploads/file-one.pdf",
    );
    expect(mocks.deleteFromS3).toHaveBeenNthCalledWith(
      2,
      "uploads/file-two.png",
    );
    expect(mocks.deleteFile).toHaveBeenNthCalledWith(1, {
      where: { id: "file-1" },
    });
    expect(mocks.deleteFile).toHaveBeenNthCalledWith(2, {
      where: { id: "file-2" },
    });
    expect(mocks.deleteUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(order).toEqual([
      "s3",
      "db:file-1",
      "s3",
      "db:file-2",
      "user",
    ]);
  });

  it("does not delete the user if S3 cleanup fails", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1" });
    mocks.findMany.mockResolvedValue([
      { id: "file-1", s3Key: "uploads/file-one.pdf" },
      { id: "file-2", s3Key: "uploads/file-two.png" },
    ]);
    mocks.deleteFromS3
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("S3 unavailable"));

    vi.resetModules();
    const { deleteAccount } = await import("../src/services/auth.service.js");

    await expect(deleteAccount("user-1")).rejects.toMatchObject({
      statusCode: 502,
      code: "S3_CLEANUP_FAILED",
    });

    expect(mocks.deleteFromS3).toHaveBeenCalledTimes(2);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(1);
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      where: { id: "file-1" },
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("does not delete the user if a file database record cannot be deleted", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1" });
    mocks.findMany.mockResolvedValue([
      { id: "file-1", s3Key: "uploads/file-one.pdf" },
    ]);
    mocks.deleteFromS3.mockResolvedValue(undefined);
    mocks.deleteFile.mockRejectedValue(
      new Error("Database unavailable"),
    );

    vi.resetModules();
    const { deleteAccount } = await import("../src/services/auth.service.js");

    await expect(deleteAccount("user-1")).rejects.toMatchObject({
      statusCode: 500,
      code: "ACCOUNT_DELETE_FAILED",
    });

    expect(mocks.deleteFromS3).toHaveBeenCalledWith(
      "uploads/file-one.pdf",
    );
    expect(mocks.deleteFile).toHaveBeenCalledWith({
      where: { id: "file-1" },
    });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("reports an error if the database cannot delete the user", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1" });
    mocks.findMany.mockResolvedValue([]);
    mocks.deleteUser.mockRejectedValue(new Error("Database unavailable"));

    vi.resetModules();
    const { deleteAccount } = await import("../src/services/auth.service.js");

    await expect(deleteAccount("user-1")).rejects.toMatchObject({
      statusCode: 500,
      code: "ACCOUNT_DELETE_FAILED",
    });

    expect(mocks.deleteUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
  });
});
