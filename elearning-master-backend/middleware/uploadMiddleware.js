const path = require('node:path');
const multer = require('multer');
const AppError = require('../utils/AppError');
const storage = require('../services/storage/r2StorageService');

const allowedExtensionsByMime = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

const VISIBILITY_BY_CATEGORY = {
  image: 'public',
  video: 'private',
  document: 'private',
  material: 'private',
  assignment: 'private',
};

const createUpload = (category, allowedMimeTypes, maxFileSize) => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1 },
    fileFilter: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      if (!allowedMimeTypes.includes(file.mimetype)
        || !allowedExtensionsByMime[file.mimetype]?.includes(extension)) {
        return callback(new AppError('Unsupported upload file type', 400));
      }
      return callback(null, true);
    },
  });

  const persist = async (req, res, next) => {
    try {
      if (req.file?.buffer) {
        const visibility = VISIBILITY_BY_CATEGORY[category] || 'private';
        const saved = await storage.saveUpload({
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          visibility,
          subdir: category,
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

  return {
    single: (field) => [upload.single(field), persist],
  };
};

const CATEGORIES = {
  image: { allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'], maxFileSize: 10 * 1024 * 1024, visibility: 'public', subdir: 'image' },
  video: { allowedMimeTypes: ['video/mp4', 'video/webm'], maxFileSize: 100 * 1024 * 1024, visibility: 'private', subdir: 'video' },
  document: { allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxFileSize: 25 * 1024 * 1024, visibility: 'private', subdir: 'document' },
  material: { allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], maxFileSize: 10 * 1024 * 1024, visibility: 'private', subdir: 'material' },
  assignment: { allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], maxFileSize: 15 * 1024 * 1024, visibility: 'private', subdir: 'assignment' },
  classroom: { allowedMimeTypes: Object.keys(allowedExtensionsByMime), maxFileSize: 25 * 1024 * 1024, visibility: 'private', subdir: 'classrooms' },
};

const validateUploadRequest = ({ category, filename, contentType, sizeBytes }) => {
  const config = CATEGORIES[category];
  if (!config) return { error: 'Unknown upload category.' };
  const extension = path.extname(filename || '').toLowerCase();
  if (!config.allowedMimeTypes.includes(contentType)
    || !allowedExtensionsByMime[contentType]?.includes(extension)) {
    return { error: 'Unsupported file type for this upload category.' };
  }
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size <= 0 || size > config.maxFileSize) {
    return { error: `File exceeds the ${Math.round(config.maxFileSize / 1024 / 1024)} MB limit.` };
  }
  return { config };
};

const imageUpload = createUpload(
  'image',
  ['image/jpeg', 'image/png', 'image/webp'],
  10 * 1024 * 1024
);

const videoUpload = createUpload(
  'video',
  ['video/mp4', 'video/webm'],
  100 * 1024 * 1024
);

const documentUpload = createUpload(
  'document',
  ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  25 * 1024 * 1024
);

const materialUpload = createUpload(
  'material',
  [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  10 * 1024 * 1024
);

const assignmentUpload = createUpload(
  'assignment',
  [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  15 * 1024 * 1024
);

module.exports = {
  image: imageUpload,
  video: videoUpload,
  document: documentUpload,
  material: materialUpload,
  assignment: assignmentUpload,
  CATEGORIES,
  validateUploadRequest,
};
