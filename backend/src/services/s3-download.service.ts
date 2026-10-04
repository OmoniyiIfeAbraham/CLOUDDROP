import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.js";

export const generateDownloadUrl = async (
  s3Key: string,
  expiresIn = 300,
) => {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
  });
};
