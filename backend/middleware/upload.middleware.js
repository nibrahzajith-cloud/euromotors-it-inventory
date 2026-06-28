const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const imagesDir = path.join(__dirname, '../uploads/images');
const documentsDir = path.join(__dirname, '../uploads/documents');

ensureDir(imagesDir);
ensureDir(documentsDir);

// Configure Storage for Images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'asset-img-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure Storage for Documents
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'asset-doc-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File Filter for Images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only image files are allowed (JPG, JPEG, PNG, WEBP)'));
};

// File Filter for Documents
const documentFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.match(/(image\/|application\/pdf|application\/msword|application\/vnd.openxmlformats-officedocument|application\/vnd.ms-excel)/);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only document files are allowed (PDF, JPG, PNG, DOC, DOCX, XLS, XLSX)'));
};

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: imageFilter
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: documentFilter
});

module.exports = {
  uploadImage,
  uploadDocument
};
