import { ApiError } from "./api-error";
import type {
  Category,
  DashboardStats,
  FileRecord,
  ShareResult,
} from "../model/file.types";

export const categoryFixtures: Category[] = [
  "Documents",
  "Images",
  "Videos",
  "Audio",
  "Archives",
  "Other",
];

const primaryFileFixture: FileRecord = {
  id: "file-document-1",
  originalName: "capstone-proposal.pdf",
  mimeType: "application/pdf",
  size: 1_204_225,
  category: "Documents",
  createdAt: "2026-10-01T08:30:00.000Z",
  updatedAt: "2026-10-01T08:30:00.000Z",
};

export const normalFileFixtures: FileRecord[] = [
  primaryFileFixture,
  {
    id: "file-image-1",
    originalName: "architecture-diagram.png",
    mimeType: "image/png",
    size: 834_520,
    category: "Images",
    createdAt: "2026-10-02T12:15:00.000Z",
    updatedAt: "2026-10-02T12:15:00.000Z",
  },
  {
    id: "file-video-1",
    originalName: "product-demo.mp4",
    mimeType: "video/mp4",
    size: 54_201_443,
    category: "Videos",
    createdAt: "2026-10-03T15:45:00.000Z",
    updatedAt: "2026-10-03T15:45:00.000Z",
  },
  {
    id: "file-audio-1",
    originalName: "meeting-notes.mp3",
    mimeType: "audio/mpeg",
    size: 8_429_014,
    category: "Audio",
    createdAt: "2026-10-04T09:00:00.000Z",
    updatedAt: "2026-10-04T09:00:00.000Z",
  },
  {
    id: "file-archive-1",
    originalName: "project-assets.zip",
    mimeType: "application/zip",
    size: 22_104_100,
    category: "Archives",
    createdAt: "2026-10-05T10:20:00.000Z",
    updatedAt: "2026-10-05T10:20:00.000Z",
  },
  {
    id: "file-other-1",
    originalName: "application-data.bin",
    mimeType: "application/octet-stream",
    size: 3_218,
    category: "Other",
    createdAt: "2026-10-05T11:00:00.000Z",
    updatedAt: "2026-10-05T11:00:00.000Z",
  },
];

export const emptyFileFixtures: FileRecord[] = [];

export const manyFileFixtures: FileRecord[] = Array.from(
  { length: 30 },
  (_, index): FileRecord => ({
    id: "file-many-" + String(index + 1),
    originalName: "report-" + String(index + 1) + ".pdf",
    mimeType: "application/pdf",
    size: 100_000 + index,
    category: "Documents",
    createdAt: "2026-10-01T08:30:00.000Z",
    updatedAt: "2026-10-01T08:30:00.000Z",
  }),
);

export const dashboardStatsFixture: DashboardStats = {
  totalFiles: normalFileFixtures.length,
  totalStorageBytes: normalFileFixtures.reduce(
    (total, file) => total + file.size,
    0,
  ),
  filesByCategory: {
    Documents: 1,
    Images: 1,
    Videos: 1,
    Audio: 1,
    Archives: 1,
    Other: 1,
  },
};

export const expiringShareFixture: ShareResult = {
  file: {
    id: primaryFileFixture.id,
    originalName: primaryFileFixture.originalName,
    mimeType: primaryFileFixture.mimeType,
  },
  shareUrl: "https://example.invalid/share/file-document-1",
  expiresIn: 5,
};

export const mockFailureFixtures = {
  unauthorized: new ApiError({
    message: "Authentication required.",
    code: "UNAUTHORIZED",
    status: 401,
  }),
  retrieval: new ApiError({
    message: "Files could not be retrieved.",
    code: "FILES_RETRIEVAL_FAILED",
    status: 500,
    retryable: true,
  }),
  deletion: new ApiError({
    message: "File could not be deleted.",
    code: "DELETE_FAILED",
    status: 500,
    retryable: true,
  }),
};
