const multer = require('multer');

// Memory storage is used because we will stream directly to S3 without saving to disk first
const storage = multer.memoryStorage();

// Validate images for Asset Image Module
const imageFileFilter = (req, file, cb) => {
    // Check mime types for JPG, PNG, WEBP
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid image format. Only JPEG, PNG, and WEBP are supported.'), false);
    }
};

// Validate documents for Asset Documents Module
const documentFileFilter = (req, file, cb) => {
    // Check mime types for PDF
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Invalid document format. Only PDF files are supported.'), false);
    }
};

// 15MB absolute limit for memory protection, though files should be heavily compressed client-side first
const limits = {
    fileSize: 15 * 1024 * 1024,
};

const uploadImageMiddleware = multer({
    storage: storage,
    fileFilter: imageFileFilter,
    limits: limits
});

const uploadDocumentMiddleware = multer({
    storage: storage,
    fileFilter: documentFileFilter,
    limits: limits
});

module.exports = {
    uploadImageMiddleware,
    uploadDocumentMiddleware
};
