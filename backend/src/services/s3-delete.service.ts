import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET_NAME } from "../config/s3.js";

export const deleteFromS3 = async (s3Key: string) => {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
};

