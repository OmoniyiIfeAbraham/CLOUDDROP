import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { create as createContentDisposition } from "content-disposition";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.js";

export const generateDownloadUrl = async (
  s3Key: string,
  expiresIn = 600,
  originalName?: string,
) => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    ...(originalName
      ? {
          ResponseContentDisposition: createContentDisposition(
            originalName,
            { type: "attachment" },
          ),
          ResponseContentType: "application/octet-stream",
        }
      : {}),
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
  });
};
