const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadImage, uploadDocument } = require('../middleware/upload.middleware');
const { logAudit, logAssetTimeline } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

router.use(authenticate);

// ==========================================
// ASSET IMAGE ROUTES
// ==========================================

// Upload / Replace Asset Image
router.post('/image/:assetId', authorize(['ADMIN', 'IT_OFFICER']), uploadImage.single('image'), async (req, res) => {
  try {
    const { assetId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      // Clean up uploaded file if asset doesn't exist
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete old image if it exists
    if (asset.imageUrl) {
      const oldPath = path.join(__dirname, '../', asset.imageUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const imageUrl = `/uploads/images/${req.file.filename}`;
    
    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: { imageUrl }
    });

    await logAssetTimeline({
      assetId: asset.id,
      assetCode: asset.assetCode,
      eventType: 'IMAGE_UPDATED',
      title: 'Asset Image Uploaded',
      description: `An image was uploaded/updated for this asset.`,
      performedById: req.user.id,
      performedByName: req.user.fullName
    });

    res.json({ message: 'Image uploaded successfully', imageUrl });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
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

    if (asset.imageUrl) {
      const oldPath = path.join(__dirname, '../', asset.imageUrl);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
      
      await prisma.asset.update({
        where: { id: assetId },
        data: { imageUrl: null }
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

    const filePath = `/uploads/documents/${req.file.filename}`;
    
    const document = await prisma.assetDocument.create({
      data: {
        assetId,
        documentName: req.file.originalname,
        documentType,
        filePath,
        fileSize: req.file.size,
        uploadedBy: req.user.id,
        uploadedByName: req.user.fullName
      }
    });

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
    const filePath = path.join(__dirname, '../', document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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

module.exports = router;
