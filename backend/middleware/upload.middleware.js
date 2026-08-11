const multer = require('multer');

const memoryStorage = multer.memoryStorage();

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const documentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const imageFilter = (req, file, cb) => {
  if (imageMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Only JPG, PNG and WEBP images are allowed'));
};

const documentFilter = (req, file, cb) => {
  if (documentMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Only PDF, JPG, and PNG documents are allowed'));
};

const uploadImageMiddleware = multer({
  storage: memoryStorage,
  limits: { files: 2, fileSize: 1 * 1024 * 1024 }, // 1 MB buffer limit
  fileFilter: imageFilter,
});

const uploadDocumentMiddleware = multer({
  storage: memoryStorage,
  limits: { files: 10, fileSize: 2 * 1024 * 1024 }, // 2 MB combined limit
  fileFilter: documentFilter,
});

module.exports = {
  uploadImageMiddleware,
  uploadDocumentMiddleware,
};
