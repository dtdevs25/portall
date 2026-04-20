import * as Minio from 'minio';
import dotenv from 'dotenv';
dotenv.config();

const endPoint = process.env.MINIO_ENDPOINT || 'minio.ctdibrasil.com.br';
const port = process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT) : undefined;
const accessKey = process.env.MINIO_ACCESS_KEY || '';
const secretKey = process.env.MINIO_SECRET_KEY || '';
const bucketName = process.env.MINIO_BUCKET || 'fotos-portall';
const useSSL = process.env.MINIO_USE_SSL === 'true';

export const minioClient = new Minio.Client({
  endPoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export const MINIO_BUCKET = bucketName;

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET);
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
    // Set public read policy for the bucket if it's for public photos
    // Or we can use presigned URLs. The user provided a "browser" link, suggesting they want them accessible.
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetBucketLocation", "s3:ListBucket"],
          Resource: [`arn:aws:s3:::${MINIO_BUCKET}`],
        },
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(MINIO_BUCKET, JSON.stringify(policy));
  }
}
