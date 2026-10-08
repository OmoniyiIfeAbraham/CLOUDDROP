export const CATEGORIES = [
  "Documents",
  "Images",
  "Videos",
  "Audio",
  "Archives",
  "Other",
] as const;

export type FileCategory = (typeof CATEGORIES)[number];

const MIME_PREFIX_TO_CATEGORY: Record<string, FileCategory> = {
  "image/": "Images",
  "video/": "Videos",
  "audio/": "Audio",
};

const MIME_TO_CATEGORY: Record<string, FileCategory> = {
  "application/pdf": "Documents",
  "application/msword": "Documents",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Documents",
  "application/vnd.ms-excel": "Documents",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Documents",
  "application/vnd.ms-powerpoint": "Documents",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Documents",
  "text/plain": "Documents",
  "text/csv": "Documents",
  "text/markdown": "Documents",
  "application/rtf": "Documents",
  "application/zip": "Archives",
  "application/x-zip-compressed": "Archives",
  "application/x-7z-compressed": "Archives",
  "application/x-rar-compressed": "Archives",
  "application/vnd.rar": "Archives",
  "application/gzip": "Archives",
  "application/x-tar": "Archives",
  "application/x-gzip": "Archives",
};

export const isFileCategory = (value: string): value is FileCategory => {
  return (CATEGORIES as readonly string[]).includes(value);
};

export const categorizeByMimeType = (mimeType: string): FileCategory => {
  const normalized = mimeType.toLowerCase().trim();
  const exact = MIME_TO_CATEGORY[normalized];
  if (exact) {
    return exact;
  }

  for (const [prefix, category] of Object.entries(MIME_PREFIX_TO_CATEGORY)) {
    if (normalized.startsWith(prefix)) {
      return category;
    }
  }

  return "Other";
};
