const multer = require('multer');

const memoryStorage = multer.memoryStorage();

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const imageFilter = (req, file, cb) => {
  if (imageMimeTypes.has(file.mimetype)) return cb(null, true);
  return cb(new Error('Only JPG, PNG and WEBP images are allowed'));
};

const documentFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') return cb(null, true);
  return cb(new Error('Only PDF documents are allowed'));
};

const uploadImageMiddleware = multer({
  storage: memoryStorage,
  limits: { files: 2, fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const uploadDocumentMiddleware = multer({
  storage: memoryStorage,
  limits: { files: 1, fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFilter,
});

module.exports = {
  uploadImageMiddleware,
  uploadDocumentMiddleware,
};
