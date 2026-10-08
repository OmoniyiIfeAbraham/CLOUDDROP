import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.js";

export const uploadToS3 = async (
  fileBuffer: Buffer,
  s3Key: string,
  mimeType: string,
) => {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return {
    bucket: S3_BUCKET_NAME,
    key: s3Key,
  };
};

