const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT || 'https://example.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'dummy_key',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'dummy_secret',
  },
  // Necessary for R2 or Supabase
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'it-inventory-assets';
const PUBLIC_URL_PREFIX = process.env.S3_PUBLIC_URL_PREFIX || 'https://pub-example.r2.dev';

/**
 * Upload a local file to S3 and return its public URL
 */
async function uploadToS3(filePath, s3Key, mimeType) {
  const fileStream = fs.createReadStream(filePath);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: mimeType,
  });

  try {
    await s3Client.send(command);
    return {
      url: `${PUBLIC_URL_PREFIX}/${s3Key}`,
      storageKey: s3Key
    };
  } catch (error) {
    console.error("S3 Upload Error:", error);
    // Return null instead of throwing to trigger local fallback
    return null;
  }
}

/**
 * Delete a file from S3 given its public URL or key
 */
async function deleteFromS3(urlOrKey) {
  let key = urlOrKey;
  if (urlOrKey.startsWith('http')) {
    key = urlOrKey.replace(`${PUBLIC_URL_PREFIX}/`, '');
  }

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("S3 Delete Error:", error);
    return false;
  }
}

/**
 * Generate a pre-signed URL for downloading an object
 */
async function getSignedDownloadUrl(s3Key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    // Create a signed URL that expires in 1 hour
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (err) {
    console.error("Error generating signed URL", err);
    return null;
  }
}

module.exports = {
  uploadToS3,
  deleteFromS3,
  getSignedDownloadUrl
};
