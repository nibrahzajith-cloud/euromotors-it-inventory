const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// Create the S3 Client
// Configured to support AWS S3, Cloudflare R2, MinIO, or Supabase Storage dynamically.
const s3Config = {
    region: process.env.AWS_REGION || 'auto',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
};

// Only add endpoint if it is defined (required for R2/Supabase)
if (process.env.AWS_ENDPOINT) {
    s3Config.endpoint = process.env.AWS_ENDPOINT;
}

const s3Client = new S3Client(s3Config);
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

/**
 * Uploads a file buffer to S3-compatible storage
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - Destination key path in bucket
 * @param {string} mimeType - The content type of the file
 * @returns {Promise<string>} The uploaded file key
 */
const uploadFile = async (fileBuffer, fileName, mimeType) => {
    if (!BUCKET_NAME) throw new Error("AWS_BUCKET_NAME is not configured.");
    
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimeType,
    });

    await s3Client.send(command);
    return fileName;
};

/**
 * Deletes a file from S3-compatible storage
 * @param {string} fileName - The key path in bucket to delete
 */
const deleteFile = async (fileName) => {
    if (!BUCKET_NAME) throw new Error("AWS_BUCKET_NAME is not configured.");
    
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
    });

    await s3Client.send(command);
};

/**
 * Generates a presigned URL to view/download a private file securely
 * @param {string} fileName - The key path in bucket
 * @param {number} expiresIn - Time in seconds until URL expires (default 1 hour)
 * @returns {Promise<string>} Secure URL string
 */
const getPresignedUrl = async (fileName, expiresIn = 3600) => {
    if (!BUCKET_NAME) throw new Error("AWS_BUCKET_NAME is not configured.");
    
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
};

module.exports = {
    s3Client,
    uploadFile,
    deleteFile,
    getPresignedUrl
};
