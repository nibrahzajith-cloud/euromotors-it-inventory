const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const REQUIRED_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_ENDPOINT',
];

let client;

function assertR2Configured() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    const error = new Error(`R2 storage is not configured. Missing: ${missing.join(', ')}`);
    error.code = 'R2_NOT_CONFIGURED';
    throw error;
  }
}

function getR2Client() {
  assertR2Configured();
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}

function validateObjectKey(key) {
  if (!key || typeof key !== 'string' || key.includes('..') || key.startsWith('/')) {
    throw new Error('Invalid R2 object key');
  }
}

async function uploadFile(buffer, key, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('A non-empty file buffer is required');
  }
  validateObjectKey(key);

  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentLength: buffer.length,
    ContentType: mimeType || 'application/octet-stream',
  }));

  return { storageKey: key };
}

async function deleteFile(key) {
  validateObjectKey(key);
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  }));
}

async function getPresignedUrl(key, expiresIn = 300, downloadName) {
  validateObjectKey(key);
  const safeExpiry = Math.min(Math.max(Number(expiresIn) || 300, 60), 3600);
  const input = {
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  };

  if (downloadName) {
    const safeName = downloadName.replace(/[\r\n"\\]/g, '_');
    input.ResponseContentDisposition = `attachment; filename="${safeName}"`;
  }

  return getSignedUrl(getR2Client(), new GetObjectCommand(input), {
    expiresIn: safeExpiry,
  });
}

module.exports = {
  assertR2Configured,
  uploadFile,
  deleteFile,
  getPresignedUrl,
};
