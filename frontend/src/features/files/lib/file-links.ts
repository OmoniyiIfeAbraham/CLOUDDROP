export const requireHttpsUrl = (value: string): string => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid file link");
  return url.toString();
};

// S3 signs this response override as part of the URL. Never add it to an
// existing link: changing a signed URL would invalidate its signature.
export const canSaveDirectly = (value: string): boolean => {
  const url = new URL(value);
  const attachment = /^attachment(?:\s*;|\s*$)/i.test(url.searchParams.get("response-content-disposition") ?? "");
  // Binary delivery also avoids inline previews in WebKit. The file's actual
  // MIME type stays in API metadata; this override applies only to its download.
  const contentType = url.searchParams.get("response-content-type")?.split(";")[0]?.trim().toLowerCase();
  return attachment && contentType === "application/octet-stream";
};

export const startFileDownload = (url: string, filename: string): void => {
  const link = document.createElement("a");
  link.href = requireHttpsUrl(url);
  link.download = filename;
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
};
