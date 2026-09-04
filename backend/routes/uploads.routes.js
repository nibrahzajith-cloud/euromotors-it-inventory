const express = require('express');
const { randomUUID } = require('crypto');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, requirePermission } = require('../middleware/auth.middleware');
const { uploadImageMiddleware, uploadGalleryMiddleware, uploadDocumentMiddleware } = require('../middleware/upload.middleware');
const { uploadFile, deleteFile, getPresignedUrl, getR2StorageStats } = require('../utils/s3Client');

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
// LOCAL FALLBACK STORAGE ROUTE
// -----------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const LOCAL_DIR = path.join(__dirname, '..', 'local_uploads');

router.get('/local/:key', (req, res) => {
    const key = req.params.key;
    const filePath = path.join(LOCAL_DIR, key);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    if (req.query.download) {
        res.download(filePath, req.query.download);
    } else {
        res.sendFile(filePath);
    }
});

// -----------------------------------------------------------------------------
// ADMIN-ONLY STORAGE MONITORING
// -----------------------------------------------------------------------------

router.get('/storage/stats', authenticate, requirePermission('VIEW_STORAGE_STATS'), async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';

        // 1. Calculate actual R2 stats (safe fallback if unconfigured or API error)
        let r2Stats = {
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
            cachedAt: new Date().toISOString(),
        };

        try {
            const fetched = await getR2StorageStats(forceRefresh);
            if (fetched) r2Stats = fetched;
        } catch (r2Err) {
            console.error('R2 Stats Safe Error:', r2Err.message);
        }

        // 2. Calculate actual PostgreSQL Database size & table breakdown
        let dbTotalBytes = 0;
        let dbPrettySize = '0 MB';
        let formattedTables = [];

        try {
            const dbSizeResult = await prisma.$queryRawUnsafe(`
                SELECT 
                    pg_database_size(current_database())::text AS total_bytes,
                    pg_size_pretty(pg_database_size(current_database())) AS pretty_size
            `);
            if (dbSizeResult && dbSizeResult[0]) {
                dbTotalBytes = Number(dbSizeResult[0].total_bytes) || 0;
                dbPrettySize = dbSizeResult[0].pretty_size || '0 MB';
            }
        } catch (dbErr) {
            console.error('Database Size Query Error:', dbErr.message);
        }

        try {
            const tableSizes = await prisma.$queryRawUnsafe(`
                SELECT 
                    relname AS table_name,
                    pg_total_relation_size(relid)::text AS total_bytes,
                    pg_relation_size(relid)::text AS table_bytes,
                    pg_indexes_size(relid)::text AS index_bytes,
                    pg_size_pretty(pg_total_relation_size(relid)) AS pretty_total_size
                FROM pg_catalog.pg_statio_user_tables
                ORDER BY pg_total_relation_size(relid) DESC
            `);
            if (Array.isArray(tableSizes)) {
                formattedTables = tableSizes.map((t) => ({
                    tableName: t.table_name,
                    totalBytes: Number(t.total_bytes) || 0,
                    tableBytes: Number(t.table_bytes) || 0,
                    indexBytes: Number(t.index_bytes) || 0,
                    prettyTotalSize: t.pretty_total_size,
                }));
            }
        } catch (tblErr) {
            console.error('Table Sizes Query Error:', tblErr.message);
        }

        // 3. Fetch configured DB reference limit from SystemSettings
        let configuredReferenceLimitMB = null;
        try {
            const settings = await prisma.systemSettings.findUnique({
                where: { id: 'global' },
                select: { dbStorageLimitMB: true },
            });
            configuredReferenceLimitMB = settings?.dbStorageLimitMB ?? null;
        } catch (_) {
            try {
                const settingsRows = await prisma.$queryRawUnsafe(`
                    SELECT "dbStorageLimitMB" FROM "SystemSettings" WHERE id = 'global' LIMIT 1;
                `);
                configuredReferenceLimitMB = settingsRows[0]?.dbStorageLimitMB ?? null;
            } catch (_) {}
        }

        res.json({
            r2: {
                isConfigured: r2Stats.isConfigured,
                totalBytes: r2Stats.totalBytes || 0,
                totalCount: r2Stats.totalCount || 0,
                breakdown: r2Stats.breakdown || {
                    images: { count: 0, bytes: 0 },
                    thumbnails: { count: 0, bytes: 0 },
                    documents: { count: 0, bytes: 0 },
                    other: { count: 0, bytes: 0 },
                },
                referenceLimitBytes: r2Stats.referenceLimitBytes || (10 * 1024 * 1024 * 1024),
                cachedAt: r2Stats.cachedAt || new Date().toISOString(),
            },
            database: {
                totalBytes: dbTotalBytes,
                prettySize: dbPrettySize,
                tables: formattedTables,
                configuredReferenceLimitMB: configuredReferenceLimitMB,
            },
        });
    } catch (error) {
        console.error('Storage Stats Fatal Error:', error);
        res.status(500).json({ error: 'Failed to retrieve storage statistics' });
    }
});

// Configure Database Reference Capacity (Admin Only)
router.post('/storage/db-capacity', authenticate, requirePermission('CONFIGURE_SYSTEM'), async (req, res) => {
    try {
        const { capacityMB } = req.body;
        let valueToSet = null;

        if (capacityMB !== null && capacityMB !== undefined && capacityMB !== '') {
            const num = Number(capacityMB);
            if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
                return res.status(400).json({ error: 'Capacity must be a positive integer in Megabytes (MB) or null to unconfigure.' });
            }
            valueToSet = num;
        }

        let savedVal = valueToSet;
        try {
            const updated = await prisma.systemSettings.upsert({
                where: { id: 'global' },
                update: { dbStorageLimitMB: valueToSet },
                create: {
                    id: 'global',
                    assetCodePrefix: 'AST',
                    warrantyPeriod: 12,
                    dbStorageLimitMB: valueToSet,
                },
            });
            savedVal = updated.dbStorageLimitMB;
        } catch (_) {
            if (valueToSet !== null) {
                await prisma.$executeRawUnsafe(`
                    UPDATE "SystemSettings" 
                    SET "dbStorageLimitMB" = ${valueToSet}, "updatedAt" = NOW() 
                    WHERE id = 'global';
                `);
            } else {
                await prisma.$executeRawUnsafe(`
                    UPDATE "SystemSettings" 
                    SET "dbStorageLimitMB" = NULL, "updatedAt" = NOW() 
                    WHERE id = 'global';
                `);
            }
        }

        await writeAuditLog({
            userId: req.user.id,
            userName: req.user.fullName,
            userRole: req.user.role,
            action: 'UPDATE_STORAGE_CAPACITY',
            module: 'SYSTEM_SETTINGS',
            description: valueToSet 
                ? `Admin set Database Reference Capacity to ${valueToSet} MB`
                : 'Admin cleared Database Reference Capacity configuration',
        });

        res.json({
            success: true,
            dbStorageLimitMB: savedVal,
        });
    } catch (error) {
        console.error('Update DB Capacity Error:', error);
        res.status(500).json({ error: 'Failed to update database reference capacity' });
    }
});

// -----------------------------------------------------------------------------
// ASSET IMAGE ROUTES
// -----------------------------------------------------------------------------

// Upload or Replace Asset Image
router.post('/image/:assetId', authenticate, requirePermission('UPLOAD_ASSET_IMAGES'), uploadImageMiddleware.fields([
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
        const imageExtension = extensionByMime[imageFile.mimetype] || 'webp';
        const thumbExtension = thumbFile ? (extensionByMime[thumbFile.mimetype] || 'webp') : 'webp';
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

        // Clean up previous image objects from R2
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
            description: `Uploaded high-quality asset image for ${asset.assetCode}`
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
router.delete('/image/:assetId', authenticate, requirePermission('DELETE_ASSET_IMAGES'), async (req, res) => {
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

// Upload Multiple Gallery Images
router.post('/gallery/:assetId', authenticate, requirePermission('UPLOAD_ASSET_IMAGES'), uploadGalleryMiddleware.array('images', 10), async (req, res) => {
    try {
        const { assetId } = req.params;
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const files = req.files;
        if (!files || files.length === 0) return res.status(400).json({ error: 'No image files provided' });

        const timestamp = Date.now();
        const safeCode = asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        const extensionByMime = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp'
        };

        const uploadPromises = files.map(async (file, index) => {
            const ext = extensionByMime[file.mimetype] || 'webp';
            const uniqueId = randomUUID().substring(0, 8);
            const imageKey = `assets/${safeCode}/images/${timestamp}_${index}_${uniqueId}.${ext}`;
            const documentId = randomUUID();

            await uploadFile(file.buffer, imageKey, file.mimetype);

            return prisma.assetDocument.create({
                data: {
                    id: documentId,
                    assetId: asset.id,
                    documentName: file.originalname,
                    documentType: 'IMAGE',
                    fileUrl: `/api/uploads/document/${documentId}/view`,
                    storageKey: imageKey,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    uploadedBy: req.user.id,
                    uploadedByName: req.user.fullName
                }
            });
        });

        const results = await Promise.all(uploadPromises);

        await writeAuditLog({
            userId: req.user.id,
            userName: req.user.fullName,
            userRole: req.user.role,
            action: 'UPLOAD_GALLERY_IMAGES',
            module: 'ASSET_MEDIA',
            entityType: 'ASSET',
            entityId: assetId,
            entityCode: asset.assetCode,
            description: `Uploaded ${results.length} images to gallery for ${asset.assetCode}`
        });

        res.json({ success: true, uploaded: results });
    } catch (error) {
        console.error('Gallery Upload Error:', error);
        return storageErrorResponse(res, error, 'Failed to upload gallery images');
    }
});

// -----------------------------------------------------------------------------
// ASSET DOCUMENTS ROUTES
// -----------------------------------------------------------------------------

// Upload Asset Document (Combined or Categorized PDF)
router.post('/document/:assetId', authenticate, requirePermission('UPLOAD_ASSET_DOCUMENTS'), uploadDocumentMiddleware.single('document'), async (req, res) => {
    try {
        const { assetId } = req.params;
        const { documentType } = req.body;
        
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return res.status(404).json({ error: 'Asset not found' });

        const file = req.file;
        if (!file) return res.status(400).json({ error: 'Document file is required' });

        const timestamp = Date.now();
        const safeCode = asset.assetCode.replace(/[^a-zA-Z0-9_-]/g, '_');
        const isImage = file.mimetype.startsWith('image/') || documentType === 'IMAGE';
        const extensionByMime = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'application/pdf': 'pdf'
        };
        const ext = extensionByMime[file.mimetype] || (isImage ? 'webp' : 'pdf');
        const docKey = isImage 
            ? `assets/${safeCode}/images/${timestamp}_${randomUUID().substring(0, 8)}.${ext}`
            : `assets/documents/${safeCode}_${timestamp}.pdf`;

        const documentId = randomUUID();
        let updatedDoc;
        await uploadFile(file.buffer, docKey, file.mimetype);
        try {
            updatedDoc = await prisma.assetDocument.create({
                data: {
                    id: documentId,
                    assetId: asset.id,
                    documentName: file.originalname,
                    documentType: documentType || 'Other Supporting Document',
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
            description: `Uploaded document (${documentType || 'Procurement Document'}) for ${asset.assetCode}`
        });

        res.json(updatedDoc);
    } catch (error) {
        console.error('Document Upload Error:', error);
        return storageErrorResponse(res, error, 'Failed to upload document');
    }
});

// Delete Asset Document
router.delete('/document/:docId', authenticate, requirePermission('DELETE_ASSET_DOCUMENTS'), async (req, res) => {
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
            entityCode: document.asset?.assetCode || 'N/A',
            description: `Deleted document ${document.documentName}`
        });

        res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Document Delete Error:', error);
        return storageErrorResponse(res, error, 'Failed to delete document');
    }
});

// Return a short-lived private URL after authenticating the application user.
router.get('/document/:docId/:type', authenticate, requirePermission('DOWNLOAD_ASSET_DOCUMENTS'), async (req, res) => {
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
