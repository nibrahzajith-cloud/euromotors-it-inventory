const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadImageMiddleware, uploadDocumentMiddleware } = require('../middleware/upload.middleware');
const { uploadFile, deleteFile, getPresignedUrl } = require('../utils/s3Client');

const mediaEditorsOnly = authorize(['ADMIN', 'IT_OFFICER']);

function storageErrorResponse(res, error, fallbackMessage) {
    if (error?.code === 'R2_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'Private file storage is not configured' });
    }
    return res.status(500).json({ error: fallbackMessage });
}

async function writeAuditLog(data) {
    try {
        await prisma.auditLog.create({ data });
    } catch (error) {
        console.error('Failed to write asset media audit log:', error);
    }
}

// -----------------------------------------------------------------------------
// ASSET IMAGE ROUTES
// -----------------------------------------------------------------------------

// Upload or Replace Asset Image
router.post('/image/:assetId', authenticate, mediaEditorsOnly, uploadImageMiddleware.fields([
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

        const timestamp = Date.now();
        const safeCode = asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, '_');
        const extensionByMime = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp'
        };
        const imageExtension = extensionByMime[imageFile.mimetype];
        const thumbExtension = thumbFile ? extensionByMime[thumbFile.mimetype] : null;
        const imageKey = `assets/images/${safeCode}_${timestamp}.${imageExtension}`;
        const thumbKey = thumbFile
            ? `assets/thumbnails/${safeCode}_${timestamp}.${thumbExtension}`
            : null;

        const newlyUploadedKeys = [];
        let updatedAsset;
        try {
            await uploadFile(imageFile.buffer, imageKey, imageFile.mimetype);
            newlyUploadedKeys.push(imageKey);
            if (thumbFile) {
                await uploadFile(thumbFile.buffer, thumbKey, thumbFile.mimetype);
                newlyUploadedKeys.push(thumbKey);
            }

            updatedAsset = await prisma.asset.update({
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
        } catch (error) {
            await Promise.allSettled(newlyUploadedKeys.map((key) => deleteFile(key)));
            throw error;
        }

        // The database now points at the new objects, so old objects can be removed safely.
        if (asset.imageStorageKey) {
            const oldKeys = [asset.imageStorageKey];
            if (asset.thumbnailUrl) {
                oldKeys.push(asset.imageStorageKey.replace('assets/images/', 'assets/thumbnails/'));
            }
            const cleanup = await Promise.allSettled(oldKeys.map((key) => deleteFile(key)));
            cleanup.filter((result) => result.status === 'rejected')
                .forEach((result) => console.error('Failed to remove replaced R2 object:', result.reason));
        }

        // Audit Log
        await writeAuditLog({
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'UPLOAD_IMAGE',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: assetId,
                entityCode: asset.assetCode,
                description: `Uploaded new asset image for ${asset.assetCode}`
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
        return storageErrorResponse(res, error, 'Failed to upload image');
    }
});

// Delete Asset Image
router.delete('/image/:assetId', authenticate, mediaEditorsOnly, async (req, res) => {
    try {
        const { assetId } = req.params;
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        
        if (!asset || !asset.imageStorageKey) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // Delete from R2
        await deleteFile(asset.imageStorageKey);
        if (asset.thumbnailUrl) {
            const thumbKey = asset.imageStorageKey.replace('assets/images/', 'assets/thumbnails/');
            await deleteFile(thumbKey);
        }

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

        await writeAuditLog({
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'DELETE_IMAGE',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: assetId,
                entityCode: asset.assetCode,
                description: `Deleted asset image for ${asset.assetCode}`
        });

        res.json({ success: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Image Delete Error:', error);
        return storageErrorResponse(res, error, 'Failed to delete image');
    }
});

// Return a short-lived private URL after authenticating the application user.
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

        const url = await getPresignedUrl(
            key,
            300,
            type === 'download' ? (asset.imageFileName || `${asset.assetCode}.webp`) : undefined
        );
        
        return res.json({ url, expiresIn: 300 });
    } catch (error) {
        console.error('Presigned URL Error:', error);
        return storageErrorResponse(res, error, 'Failed to generate secure URL');
    }
});


// -----------------------------------------------------------------------------
// ASSET DOCUMENTS ROUTES
// -----------------------------------------------------------------------------

// Upload Asset Document (Merged PDF)
router.post('/document/:assetId', authenticate, mediaEditorsOnly, uploadDocumentMiddleware.single('document'), async (req, res) => {
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

        const documentId = randomUUID();
        let updatedDoc;
        await uploadFile(file.buffer, docKey, file.mimetype);
        try {
            updatedDoc = await prisma.assetDocument.create({
                data: {
                    id: documentId,
                    assetId: asset.id,
                    documentName: file.originalname,
                    documentType: documentType || 'Asset Document',
                    fileUrl: `/api/uploads/document/${documentId}/view`,
                    storageKey: docKey,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    uploadedBy: req.user.id,
                    uploadedByName: req.user.fullName
                }
            });
        } catch (error) {
            await deleteFile(docKey).catch((cleanupError) => {
                console.error('Failed to clean up R2 object after database error:', cleanupError);
            });
            throw error;
        }

        await writeAuditLog({
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'UPLOAD_DOCUMENT',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: assetId,
                entityCode: asset.assetCode,
                description: `Uploaded document ${file.originalname} for ${asset.assetCode}`
        });

        res.json(updatedDoc);
    } catch (error) {
        console.error('Document Upload Error:', error);
        return storageErrorResponse(res, error, 'Failed to upload document');
    }
});

// Delete Asset Document
router.delete('/document/:docId', authenticate, mediaEditorsOnly, async (req, res) => {
    try {
        const { docId } = req.params;
        const document = await prisma.assetDocument.findUnique({ 
            where: { id: docId },
            include: { asset: true }
        });
        
        if (!document) return res.status(404).json({ error: 'Document not found' });

        // Delete from R2
        if (document.storageKey) {
            await deleteFile(document.storageKey);
        }

        // Delete DB record
        await prisma.assetDocument.delete({ where: { id: docId } });

        await writeAuditLog({
                userId: req.user.id,
                userName: req.user.fullName,
                userRole: req.user.role,
                action: 'DELETE_DOCUMENT',
                module: 'ASSET_MEDIA',
                entityType: 'ASSET',
                entityId: document.assetId,
                entityCode: document.asset.assetCode,
                description: `Deleted document ${document.documentName} for ${document.asset.assetCode}`
        });

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Document Delete Error:', error);
        return storageErrorResponse(res, error, 'Failed to delete document');
    }
});

// Return a short-lived private URL after authenticating the application user.
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

        const url = await getPresignedUrl(
            document.storageKey,
            300,
            type === 'download' ? document.documentName : undefined
        );
        
        return res.json({ url, expiresIn: 300 });
    } catch (error) {
        console.error('Presigned URL Error:', error);
        return storageErrorResponse(res, error, 'Failed to generate secure URL');
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

module.exports = router;
