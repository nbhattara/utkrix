const express = require('express');
const protect = require('../middleware/authMiddleware');
const storage = require('../services/storage/r2StorageService');
const { validateUploadRequest } = require('../middleware/uploadMiddleware');
const AppError = require('../utils/AppError');

const router = express.Router();
router.use(protect);

// POST /api/v1/uploads/presign
// Body: { category, filename, contentType, sizeBytes }
// Returns a short-lived direct-to-R2 upload URL for large files that exceed
// the serverless function body limit.
router.post('/presign', async (req, res, next) => {
  try {
    if (!storage.isR2Configured()) {
      throw new AppError('Direct uploads are not configured. Use the standard upload endpoint.', 503);
    }
    const { category, filename, contentType, sizeBytes } = req.body || {};
    const { config, error } = validateUploadRequest({ category, filename, contentType, sizeBytes });
    if (error) throw new AppError(error, 400);

    const key = storage.uniqueKey(config.subdir, filename);
    const uploadUrl = await storage.getPresignedUploadUrl({
      key,
      visibility: config.visibility,
      contentType,
      expiresIn: 600,
    });
    if (!uploadUrl) throw new AppError('Could not create upload URL.', 503);

    return res.status(201).json({
      key,
      uploadUrl,
      visibility: config.visibility,
      expiresIn: 600,
    });
  } catch (error) {
    return next(error);
  }
});

// POST /api/v1/uploads/complete
// Body: { key, category, filename?, contentType? }
// Verifies the object actually exists in R2 before accepting it.
router.post('/complete', async (req, res, next) => {
  try {
    const { key, category, filename, contentType } = req.body || {};
    if (typeof key !== 'string' || !key) throw new AppError('Missing object key.', 400);

    const { config, error } = validateUploadRequest({
      category,
      filename: filename || key,
      contentType,
      sizeBytes: 1,
    });
    const visibility = config?.visibility || 'private';

    let head = null;
    try {
      head = await storage.headObject({ key, visibility });
    } catch {
      head = null;
    }
    if (!head) throw new AppError('Uploaded object not found. Complete the upload first.', 404);

    return res.json({
      key,
      url: config?.visibility === 'public' ? storage.publicUrlFor(key) : null,
      visibility,
      size: head.ContentLength,
      contentType: head.ContentType,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
