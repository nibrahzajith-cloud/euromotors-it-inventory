const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadImage, uploadDocument } = require('../middleware/upload.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');
const { uploadToS3, deleteFromS3, getSignedDownloadUrl } = require('../utils/s3Client');
const fs = require('fs');
const path = require('path');

router.use(authenticate);

// ==========================================
// ASSET IMAGE ROUTES
// ==========================================

// Upload / Replace Asset Image
router.post('/image/:assetId', authorize(['ADMIN', 'IT_OFFICER']), uploadImage.fields([{ name: 'image', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!req.files || !req.files.image || !req.files.image[0]) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    const imageFile = req.files.image[0];
    const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      // Clean up uploaded file if asset doesn't exist
      fs.unlinkSync(imageFile.path);
      if (thumbnailFile) fs.unlinkSync(thumbnailFile.path);
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete old image if it exists
    if (asset.imageUrl) {
      if (asset.imageUrl.startsWith('http')) {
        await deleteFromS3(asset.imageUrl);
      } else {
        const oldPath = path.join(__dirname, '../', asset.imageUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }
    
    // Delete old thumbnail if it exists
    if (asset.thumbnailUrl) {
      if (asset.thumbnailUrl.startsWith('http')) {
        await deleteFromS3(asset.thumbnailUrl);
      } else {
        const oldPath = path.join(__dirname, '../', asset.thumbnailUrl);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    // Upload new image to S3
    const s3Key = `images/${Date.now()}-${imageFile.originalname}`;
    let uploadRes = await uploadToS3(imageFile.path, s3Key, imageFile.mimetype);
    let imageUrl = uploadRes ? uploadRes.url : `/uploads/images/${path.basename(imageFile.path)}`;
    let imageStorageKey = uploadRes ? uploadRes.storageKey : null;
    
    if (uploadRes) {
      fs.unlinkSync(imageFile.path);
    }
    
    // Upload thumbnail to S3 if provided
    let thumbnailUrl = null;
    if (thumbnailFile) {
      const thumbS3Key = `thumbnails/${Date.now()}-thumb-${imageFile.originalname}`;
      let thumbRes = await uploadToS3(thumbnailFile.path, thumbS3Key, thumbnailFile.mimetype);
      if (thumbRes) {
        thumbnailUrl = thumbRes.url;
        fs.unlinkSync(thumbnailFile.path);
      } else {
        thumbnailUrl = `/uploads/images/${path.basename(thumbnailFile.path)}`;
      }
    }
    
    try {
      const updatedAsset = await prisma.asset.update({
        where: { id: assetId },
        data: { 
          imageUrl, 
          thumbnailUrl,
          imageStorageKey,
          imageFileName: imageFile.originalname,
          imageFileSize: imageFile.size,
          imageMimeType: imageFile.mimetype,
          imageUploadedAt: new Date(),
          imageUploadedBy: req.user.id
        }
      });
    } catch (dbErr) {
       // Rollback S3 upload
       if (imageStorageKey) await deleteFromS3(imageStorageKey);
       throw new Error('Database error. Image upload rolled back.');
    }

    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'IMAGE_UPDATED',
      title: 'Asset Image Uploaded',
      description: `An image was uploaded/updated for this asset.`,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.json({ 
      message: 'Image uploaded successfully', 
      imageUrl, 
      thumbnailUrl,
      imageFileName: imageFile.originalname,
      imageFileSize: imageFile.size,
      imageMimeType: imageFile.mimetype,
      imageUploadedAt: new Date()
    });
  } catch (err) {
    if (req.files && req.files.image && fs.existsSync(req.files.image[0].path)) {
      fs.unlinkSync(req.files.image[0].path);
    }
    if (req.files && req.files.thumbnail && fs.existsSync(req.files.thumbnail[0].path)) {
      fs.unlinkSync(req.files.thumbnail[0].path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete Asset Image
router.delete('/image/:assetId', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const { assetId } = req.params;
    
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    if (asset.imageStorageKey || asset.imageUrl) {
      if (asset.imageStorageKey) {
        await deleteFromS3(asset.imageStorageKey);
      } else if (asset.imageUrl && asset.imageUrl.startsWith('http')) {
        await deleteFromS3(asset.imageUrl);
      } else if (asset.imageUrl) {
        const oldPath = path.join(__dirname, '../', asset.imageUrl);
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (unlinkErr) {
            console.warn(`Failed to unlink image ${oldPath}, proceeding:`, unlinkErr.message);
          }
        }
      }
      
      if (asset.thumbnailUrl) {
        if (asset.thumbnailUrl.startsWith('http')) {
          await deleteFromS3(asset.thumbnailUrl);
        } else {
          const oldPath = path.join(__dirname, '../', asset.thumbnailUrl);
          if (fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch (unlinkErr) {
              console.warn(`Failed to unlink thumbnail ${oldPath}, proceeding:`, unlinkErr.message);
            }
          }
        }
      }
      
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

      await logAssetTimeline({
        assetId: asset.id,
        assetCode: asset.assetCode,
        eventType: 'IMAGE_DELETED',
        title: 'Asset Image Removed',
        description: `The image for this asset was removed.`,
        performedById: req.user.id,
        performedByName: req.user.fullName
      });
    }

    res.json({ message: 'Image removed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Download Image (Signed URL)
router.get('/image/:assetId/download', async (req, res) => {
  try {
    const { assetId } = req.params;
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || !asset.imageStorageKey) {
      return res.status(404).json({ error: 'Image not found or not stored securely' });
    }
    
    const signedUrl = await getSignedDownloadUrl(asset.imageStorageKey);
    if (!signedUrl) return res.status(500).json({ error: 'Failed to generate download URL' });
    
    res.json({ url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ASSET DOCUMENTS ROUTES
// ==========================================

// Upload Document
router.post('/document/:assetId', authorize(['ADMIN', 'IT_OFFICER']), uploadDocument.single('document'), async (req, res) => {
  try {
    const { assetId } = req.params;
    const { documentType } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded' });
    }
    
    if (!documentType) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Document type is required' });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Upload to S3
    const s3Key = `documents/${Date.now()}-${req.file.originalname}`;
    let uploadRes = await uploadToS3(req.file.path, s3Key, req.file.mimetype);
    
    let fileUrl = uploadRes ? uploadRes.url : `/uploads/documents/${path.basename(req.file.path)}`;
    let storageKey = uploadRes ? uploadRes.storageKey : null;

    if (uploadRes) {
      // Delete temp file if S3 upload succeeded
      fs.unlinkSync(req.file.path);
    }
    
    let document;
    try {
      document = await prisma.assetDocument.create({
        data: {
          assetId,
          documentName: req.file.originalname,
          documentType,
          fileUrl,
          storageKey,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedBy: req.user.id,
          uploadedByName: req.user.fullName
        }
      });
    } catch (dbErr) {
       if (storageKey) await deleteFromS3(storageKey);
       throw new Error('Database error. Document upload rolled back.');
    }

    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'DOCUMENT_ADDED',
      title: 'Document Uploaded',
      description: `Document '${req.file.originalname}' (${documentType}) was added.`,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.status(201).json(document);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Get Documents for Asset
router.get('/documents/:assetId', async (req, res) => {
  try {
    const { assetId } = req.params;
    const documents = await prisma.assetDocument.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Document
router.delete('/document/:docId', authorize(['ADMIN', 'IT_OFFICER']), async (req, res) => {
  try {
    const { docId } = req.params;
    
    const document = await prisma.assetDocument.findUnique({ 
      where: { id: docId },
      include: { asset: true }
    });
    
    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Delete file
    if (document.storageKey) {
      await deleteFromS3(document.storageKey);
    } else if (document.fileUrl && document.fileUrl.startsWith('http')) {
      await deleteFromS3(document.fileUrl);
    } else if (document.fileUrl) {
      const filePath = path.join(__dirname, '../', document.fileUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.warn(`Failed to unlink file ${filePath}, but proceeding with DB deletion:`, unlinkErr.message);
        }
      }
    }
    
    await prisma.assetDocument.delete({ where: { id: docId } });

    await logAssetTimeline({
      assetId: document.assetId,
      assetCode: document.asset.assetCode,
      eventType: 'DOCUMENT_DELETED',
      title: 'Document Deleted',
      description: `Document '${document.documentName}' was deleted.`,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download Document (Signed URL)
router.get('/document/:docId/download', async (req, res) => {
  try {
    const { docId } = req.params;
    const document = await prisma.assetDocument.findUnique({ where: { id: docId } });
    if (!document || !document.storageKey) {
      return res.status(404).json({ error: 'Document not found or not stored securely' });
    }
    
    const signedUrl = await getSignedDownloadUrl(document.storageKey);
    if (!signedUrl) return res.status(500).json({ error: 'Failed to generate download URL' });
    
    res.json({ url: signedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
