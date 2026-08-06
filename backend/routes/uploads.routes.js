const express = require('express');
const router = express.Router();

// =============================================================================
// ASSET MEDIA MODULE — TEMPORARILY DISABLED FOR PRODUCTION
// =============================================================================
//
// Status: Under Development
// Feature Branch: feature/enterprise-asset-media-r2
//
// All upload, download, preview, delete, compression, PDF merge, and presigned
// URL routes are commented out below. They will be re-enabled once:
//
//   1. Cloudflare R2 integration is fully tested on localhost
//   2. Image optimization pipeline is validated
//   3. PDF merge and document versioning is approved
//   4. Presigned URL security model is reviewed
//   5. Integration is merged from feature/enterprise-asset-media-r2 → main
//
// To re-enable: uncomment the block below and restore the original imports.
// DO NOT DELETE — all original code is preserved.
//
// Original imports (restore when re-enabling):
//   const prisma = require('../prismaClient');
//   const { authenticate } = require('../middleware/auth.middleware');
//   const { uploadImageMiddleware, uploadDocumentMiddleware } = require('../middleware/upload.middleware');
//   const { uploadFile, deleteFile, getPresignedUrl } = require('../utils/s3Client');
//
// =============================================================================

// Return 503 with a clear message for any /uploads/* request that reaches the server.
// This makes the disabled state explicit rather than silently failing.
const DISABLED_RESPONSE = {
    error: 'Asset Media Module is under development and not available in this release.',
    code: 'FEATURE_UNDER_DEVELOPMENT',
    module: 'ASSET_MEDIA',
    availableIn: 'future-release'
};

router.use((req, res) => {
    res.status(503).json(DISABLED_RESPONSE);
});

module.exports = router;


// =============================================================================
// PRESERVED IMPLEMENTATION — DO NOT DELETE
// Uncomment this entire block to restore full functionality.
// =============================================================================

/*

const prisma = require('../prismaClient');
const { authenticate } = require('../middleware/auth.middleware');
const { uploadImageMiddleware, uploadDocumentMiddleware } = require('../middleware/upload.middleware');
const { uploadFile, deleteFile, getPresignedUrl } = require('../utils/s3Client');

// -----------------------------------------------------------------------------
// ASSET IMAGE ROUTES
// -----------------------------------------------------------------------------

// Upload or Replace Asset Image
router.post('/image/:assetId', authenticate, uploadImageMiddleware.fields([
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        const { assetId } = req.params;
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const imageFile = req.files['image'] ? req.files['image'][0] : null;
        const thumbFile = req.files['thumbnail'] ? req.files['thumbnail'][0] : null;

        if (!imageFile) return res.status(400).json({ error: 'Image file is required' });

        // If replacing an existing image, delete the old one from S3 first
        if (asset.imageStorageKey) {
            try { await deleteFile(asset.imageStorageKey); } catch (e) { console.error('Failed to delete old image:', e); }
            const oldThumbKey = asset.imageStorageKey.replace('assets/images/', 'assets/thumbnails/');
            try { await deleteFile(oldThumbKey); } catch (e) {}
        }

        const timestamp = Date.now();
        const safeCode = asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, '_');
        const imageKey = `assets/images/${safeCode}_${timestamp}.webp`;
        const thumbKey = `assets/thumbnails/${safeCode}_${timestamp}.webp`;

        // Upload to S3
        await uploadFile(imageFile.buffer, imageKey, imageFile.mimetype);
        if (thumbFile) {
            await uploadFile(thumbFile.buffer, thumbKey, thumbFile.mimetype);
        }

        // Update Database
        const updatedAsset = await prisma.asset.update({
            where: { id: assetId },
            data: {
                imageUrl: `/api/uploads/image/${assetId}/view`,
                thumbnailUrl: thumbFile ? `/api/uploads/image/${assetId}/thumb` : null,
                imageStorageKey: imageKey,
                imageFileName: imageFile.originalname,
                imageFileSize: imageFile.size,
                imageMimeType: imageFile.mimetype,
                imageUploadedAt: new Date(),
                imageUploadedBy: req.user.id
            }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'UPLOAD_IMAGE',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: assetId,
                entityCode: asset.assetCode,
                description: `Uploaded new asset image for ${asset.assetCode}`
            }
        });

        res.json({
            imageUrl: updatedAsset.imageUrl,
            thumbnailUrl: updatedAsset.thumbnailUrl,
            imageFileName: updatedAsset.imageFileName,
            imageFileSize: updatedAsset.imageFileSize,
            imageMimeType: updatedAsset.imageMimeType,
            imageUploadedAt: updatedAsset.imageUploadedAt
        });
    } catch (error) {
        console.error('Image Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload image. Ensure storage variables are configured.' });
    }
});

// Delete Asset Image
router.delete('/image/:assetId', authenticate, async (req, res) => {
    try {
        const { assetId } = req.params;
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        
        if (!asset || !asset.imageStorageKey) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Delete from S3
        await deleteFile(asset.imageStorageKey);
        const thumbKey = asset.imageStorageKey.replace('assets/images/', 'assets/thumbnails/');
        try { await deleteFile(thumbKey); } catch(e) {}

        // Update DB
        await prisma.asset.update({
            where: { id: assetId },
            data: {
                imageUrl: null,
                thumbnailUrl: null,
                imageStorageKey: null,
                imageFileName: null,
                imageFileSize: null,
                imageMimeType: null,
                imageUploadedAt: null,
                imageUploadedBy: null
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'DELETE_IMAGE',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: assetId,
                entityCode: asset.assetCode,
                description: `Deleted asset image for ${asset.assetCode}`
            }
        });

        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Image Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

// View / Download Image (Redirects to Presigned URL)
router.get('/image/:assetId/:type', authenticate, async (req, res) => {
    try {
        const { assetId, type } = req.params;
        if (!['view', 'thumb', 'download'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type parameter' });
        }
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        
        if (!asset || !asset.imageStorageKey) {
            return res.status(404).json({ error: 'Image not found' });
        }

        let key = asset.imageStorageKey;
        if (type === 'thumb') {
            key = key.replace('assets/images/', 'assets/thumbnails/');
        }

        const url = await getPresignedUrl(key, 3600); // 1 hour expiry
        
        if (type === 'download') {
            return res.json({ url });
        } else {
            return res.redirect(url);
        }
    } catch (error) {
        console.error('Presigned URL Error:', error);
        res.status(500).json({ error: 'Failed to generate secure URL' });
    }
});


// -----------------------------------------------------------------------------
// ASSET DOCUMENTS ROUTES
// -----------------------------------------------------------------------------

// Upload Asset Document (Merged PDF)
router.post('/document/:assetId', authenticate, uploadDocumentMiddleware.single('document'), async (req, res) => {
    try {
        const { assetId } = req.params;
        const { documentType } = req.body;
        
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Document file is required' });

        const timestamp = Date.now();
        const safeCode = asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, '_');
        const docKey = `assets/documents/${safeCode}_${timestamp}.pdf`;

        // Upload to S3
        await uploadFile(file.buffer, docKey, file.mimetype);

        // Create DB record
        const newDoc = await prisma.assetDocument.create({
            data: {
                assetId: asset.id,
                documentName: file.originalname,
                documentType: documentType || 'Asset Document',
                fileUrl: '', // Will update with custom route
                storageKey: docKey,
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedBy: req.user.id,
                uploadedByName: req.user.fullName
            }
        });

        // Update the URL to point to our secure proxy endpoint
        const updatedDoc = await prisma.assetDocument.update({
            where: { id: newDoc.id },
            data: {
                fileUrl: `/api/uploads/document/${newDoc.id}/view`
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'UPLOAD_DOCUMENT',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: assetId,
                entityCode: asset.assetCode,
                description: `Uploaded document ${file.originalname} for ${asset.assetCode}`
            }
        });

        res.json(updatedDoc);
    } catch (error) {
        console.error('Document Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload document. Ensure storage variables are configured.' });
    }
});

// Delete Asset Document
router.delete('/document/:docId', authenticate, async (req, res) => {
    try {
        const { docId } = req.params;
        const document = await prisma.assetDocument.findUnique({ 
            where: { id: docId },
            include: { asset: true }
        });
        
        if (!document) return res.status(404).json({ error: 'Document not found' });

        // Delete from S3
        if (document.storageKey) {
            await deleteFile(document.storageKey);
        }

        // Delete DB record
        await prisma.assetDocument.delete({ where: { id: docId } });

        await prisma.auditLog.create({
            data: {
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'DELETE_DOCUMENT',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: document.assetId,
                entityCode: document.asset.assetCode,
                description: `Deleted document ${document.documentName} for ${document.asset.assetCode}`
            }
        });

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Document Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// View / Download Document (Redirects to Presigned URL)
router.get('/document/:docId/:type', authenticate, async (req, res) => {
    try {
        const { docId, type } = req.params;
        if (!['view', 'download'].includes(type)) {
            return res.status(400).json({ error: 'Invalid type parameter' });
        }
        const document = await prisma.assetDocument.findUnique({ where: { id: docId } });
        
        if (!document || !document.storageKey) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const url = await getPresignedUrl(document.storageKey, 3600); // 1 hour expiry
        
        if (type === 'download') {
            return res.json({ url });
        } else {
            return res.redirect(url);
        }
    } catch (error) {
        console.error('Presigned URL Error:', error);
        res.status(500).json({ error: 'Failed to generate secure URL' });
    }
});

// List Documents for Asset
router.get('/documents/:assetId', authenticate, async (req, res) => {
    try {
        const docs = await prisma.assetDocument.findMany({
            where: { assetId: req.params.assetId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

*/
