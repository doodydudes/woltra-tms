const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { createAdminClient } = require('@insforge/sdk');

const insforge = createAdminClient({
  baseUrl: process.env.INSFORGE_URL,
  apiKey:  process.env.INSFORGE_API_KEY,
});

const FIELD_CONFIG = {
  signature:       { bucket: 'signatures', prefix: 'signatures' },
  loading_photo:   { bucket: 'photos',     prefix: 'loading'    },
  unloading_photo: { bucket: 'photos',     prefix: 'unloading'  },
  delivery_photo:  { bucket: 'photos',     prefix: 'delivery'   },
  document_photos: { bucket: 'documents',  prefix: 'documents'  },
  photo:           { bucket: 'photos',     prefix: 'misc'       },
};

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
});

async function uploadToStorage(file) {
  const cfg    = FIELD_CONFIG[file.fieldname] || { bucket: 'photos', prefix: 'misc' };
  const ext    = path.extname(file.originalname).toLowerCase() || '.jpg';
  const key    = `${cfg.prefix}/${uuidv4()}${ext}`;

  const { error } = await insforge.storage.from(cfg.bucket).upload(key, file.buffer, {
    contentType: file.mimetype,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const base = process.env.INSFORGE_URL;
  return `${base}/storage/v1/object/public/${cfg.bucket}/${key}`;
}

module.exports = { upload, uploadToStorage };
