const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const logger = require('../../utils/logger');

const isR2Configured = () => Boolean(
  process.env.R2_ACCOUNT_ID
  && process.env.R2_ACCESS_KEY_ID
  && process.env.R2_SECRET_ACCESS_KEY
  && (process.env.R2_PUBLIC_BUCKET || process.env.R2_PRIVATE_BUCKET)
);

const endpoint = () => `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const bucketFor = (visibility = 'private') => (
  visibility === 'public'
    ? process.env.R2_PUBLIC_BUCKET
    : process.env.R2_PRIVATE_BUCKET
) || process.env.R2_PUBLIC_BUCKET || process.env.R2_PRIVATE_BUCKET;

const publicUrlFor = (key) => {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  return base ? `${base}/${key}` : null;
};

let s3Client = null;
let presigner = null;

async function getS3() {
  if (!isR2Configured()) return null;
  if (!s3Client) {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint(),
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
}

async function getPresign() {
  if (!presigner) {
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    presigner = getSignedUrl;
  }
  return presigner;
}

const assertSafeKey = (key) => {
  if (typeof key !== 'string' || !key || key.length > 512 || key.includes('..') || key.startsWith('/')) {
    throw new Error('Invalid storage object key');
  }
  return key;
};

const uniqueKey = (prefix, originalName = '') => {
  const ext = path.extname(originalName || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  return assertSafeKey(`${prefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
};

const localDirFor = (visibility, subdir = '') => {
  const root = visibility === 'public' ? 'uploads' : path.join('private-uploads', subdir || 'general');
  return path.join(__dirname, '..', '..', root);
};

/**
 * Persist an uploaded file. Uses R2 when configured, otherwise local disk
 * (preserving the legacy uploads/ and private-uploads/ layout for dev).
 * Returns { key, filename, path?, url?, visibility, bucket? }.
 */
async function saveUpload({ buffer, originalname, mimetype, visibility = 'private', subdir = '' }) {
  const client = await getS3();
  if (client) {
    const key = uniqueKey(visibility === 'public' ? 'public' : (subdir || 'private'), originalname);
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await client.send(new PutObjectCommand({
      Bucket: bucketFor(visibility),
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
    }));
    return {
      key,
      filename: key,
      url: visibility === 'public' ? publicUrlFor(key) : null,
      visibility,
      bucket: bucketFor(visibility),
      mimetype,
      size: buffer.length,
    };
  }

  const dir = localDirFor(visibility, subdir);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(originalname || '').toLowerCase()}`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return {
    key: filename,
    filename,
    path: filePath,
    url: visibility === 'public' ? `/uploads/${filename}` : null,
    visibility,
    mimetype,
    size: buffer.length,
  };
}

async function deleteObject({ key, visibility = 'private' }) {
  if (!key) return;
  const client = await getS3();
  if (client && !isLegacyLocalKey(key)) {
    try {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await client.send(new DeleteObjectCommand({ Bucket: bucketFor(visibility), Key: assertSafeKey(key) }));
      return;
    } catch (error) {
      logger.error('Failed to delete R2 object', { key, message: error.message });
      return;
    }
  }
  const dir = localDirFor(visibility, 'classrooms');
  try {
    await fs.unlink(path.join(dir, path.basename(key)));
  } catch (error) {
    if (error.code !== 'ENOENT') logger.error('Failed to remove local upload', { key, message: error.message });
  }
}

const isLegacyLocalKey = (key) => !key.includes('/');

async function headObject({ key, visibility = 'private' }) {
  const client = await getS3();
  if (!client) return null;
  const { HeadObjectCommand } = require('@aws-sdk/client-s3');
  const result = await client.send(new HeadObjectCommand({
    Bucket: bucketFor(visibility),
    Key: assertSafeKey(key),
  }));
  return result;
}

async function getPresignedDownloadUrl({ key, visibility = 'private', expiresIn = 300 }) {
  const client = await getS3();
  if (!client) return null;
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const getSignedUrl = await getPresign();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucketFor(visibility),
    Key: assertSafeKey(key),
    ResponseContentDisposition: 'attachment',
  }), { expiresIn });
}

async function getPresignedUploadUrl({ key, visibility = 'private', contentType, expiresIn = 600 }) {
  const client = await getS3();
  if (!client) return null;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const getSignedUrl = await getPresign();
  return getSignedUrl(client, new PutObjectCommand({
    Bucket: bucketFor(visibility),
    Key: assertSafeKey(key),
    ContentType: contentType || 'application/octet-stream',
  }), { expiresIn });
}

module.exports = {
  isR2Configured,
  saveUpload,
  deleteObject,
  headObject,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  publicUrlFor,
  uniqueKey,
  assertSafeKey,
};
