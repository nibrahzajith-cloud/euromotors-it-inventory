const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
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
let storageCache = {
  data: null,
  timestamp: 0,
};
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

function isR2Configured() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  return missing.length === 0;
}

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

const fs = require('fs');
const path = require('path');
const LOCAL_DIR = path.join(__dirname, '..', 'local_uploads');

function getLocalFilePath(key) {
  return path.join(LOCAL_DIR, key.replace(/\//g, '_'));
}

async function uploadFile(buffer, key, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('A non-empty file buffer is required');
  }
  validateObjectKey(key);

  if (isR2Configured()) {
    await getR2Client().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: mimeType || 'application/octet-stream',
    }));
  } else {
    if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(getLocalFilePath(key), buffer);
  }

  // Invalidate cache on new upload
  storageCache.timestamp = 0;

  return { storageKey: key };
}

async function deleteFile(key) {
  validateObjectKey(key);
  if (isR2Configured()) {
    await getR2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    }));
  } else {
    const filePath = getLocalFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Invalidate cache on delete
  storageCache.timestamp = 0;
}

async function getPresignedUrl(key, expiresIn = 300, downloadName) {
  validateObjectKey(key);
  if (isR2Configured()) {
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
  } else {
    const fileName = downloadName ? `?download=${encodeURIComponent(downloadName)}` : '';
    return `/api/uploads/local/${encodeURIComponent(key.replace(/\//g, '_'))}${fileName}`;
  }
}

async function getR2StorageStats(forceRefresh = false) {
  if (!isR2Configured()) {
    return {
      isConfigured: false,
      totalBytes: 0,
      totalCount: 0,
      breakdown: {
        images: { count: 0, bytes: 0 },
        thumbnails: { count: 0, bytes: 0 },
        documents: { count: 0, bytes: 0 },
        other: { count: 0, bytes: 0 },
      },
      referenceLimitBytes: 10 * 1024 * 1024 * 1024,
    };
  }

  const now = Date.now();
  if (!forceRefresh && storageCache.data && (now - storageCache.timestamp < CACHE_TTL_MS)) {
    return storageCache.data;
  }

  const r2 = getR2Client();
  let isTruncated = true;
  let continuationToken = undefined;
  let totalBytes = 0;
  let totalCount = 0;

  const breakdown = {
    images: { count: 0, bytes: 0 },
    thumbnails: { count: 0, bytes: 0 },
    documents: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };

  while (isTruncated) {
    const response = await r2.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    }));

    const contents = response.Contents || [];
    for (const item of contents) {
      const size = Number(item.Size) || 0;
      const key = item.Key || '';
      totalCount++;
      totalBytes += size;

      if (key.startsWith('assets/images/')) {
        breakdown.images.count++;
        breakdown.images.bytes += size;
      } else if (key.startsWith('assets/thumbnails/')) {
        breakdown.thumbnails.count++;
        breakdown.thumbnails.bytes += size;
      } else if (key.startsWith('assets/documents/')) {
        breakdown.documents.count++;
        breakdown.documents.bytes += size;
      } else {
        breakdown.other.count++;
        breakdown.other.bytes += size;
      }
    }

    isTruncated = Boolean(response.IsTruncated);
    continuationToken = response.NextContinuationToken;
  }

  const result = {
    isConfigured: true,
    totalBytes,
    totalCount,
    breakdown,
    referenceLimitBytes: 10 * 1024 * 1024 * 1024, // 10 GB Reference Level
    cachedAt: new Date().toISOString(),
  };

  storageCache = {
    data: result,
    timestamp: now,
  };

  return result;
}

module.exports = {
  isR2Configured,
  assertR2Configured,
  uploadFile,
  deleteFile,
  getPresignedUrl,
  getR2StorageStats,
};
