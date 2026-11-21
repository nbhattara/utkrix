const crypto = require('node:crypto');
const path = require('node:path');
const multer = require('multer');
const AppError = require('../utils/AppError');
const storage = require('../services/storage/r2StorageService');

const classroomUploadDirectory = path.join(__dirname, '..', 'private-uploads', 'classrooms');

const allowedExtensionsByMime = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensionsByMime[file.mimetype]?.includes(extension)) {
      return callback(new AppError('Upload a PDF, DOC, DOCX, PPTX, JPG, or PNG file.', 400));
    }
    return callback(null, true);
  },
});

const persist = async (req, res, next) => {
  try {
    if (req.file?.buffer) {
      const saved = await storage.saveUpload({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        visibility: 'private',
        subdir: 'classrooms',
      });
      req.file.filename = saved.filename;
      req.file.path = saved.path;
      req.file.url = saved.url;
      req.file.storageKey = saved.key;
      req.file.storageVisibility = saved.visibility;
      req.file.size = saved.size;
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

const attachment = [
  upload.single('attachment'),
  persist,
];

module.exports = {
  attachment,
  classroomUploadDirectory,
};
