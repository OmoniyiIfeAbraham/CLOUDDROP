import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { create as createContentDisposition } from "content-disposition";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.js";

type FileResponseMode = "inline" | "attachment";

export const generateDownloadUrl = async (
  s3Key: string,
  expiresIn = 600,
  originalName?: string,
  mimeType?: string,
  mode: FileResponseMode = "attachment",
) => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    ...(originalName
      ? {
          ResponseContentDisposition: createContentDisposition(
            originalName,
            { type: mode },
          ),
          ResponseContentType:
            mode === "inline"
              ? mimeType ?? "application/octet-stream"
              : "application/octet-stream",
        }
      : {}),
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};
