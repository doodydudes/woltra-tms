const multer  = require('multer');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

// Lazily create the service-role client so a missing env var doesn't crash
// the server at boot — only uploads will fail until storage is configured.
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY missing)');
  }
  _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return _supabase;
}

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

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(cfg.bucket).upload(key, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
  });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(cfg.bucket).getPublicUrl(key);
  return data.publicUrl;
}

module.exports = { upload, uploadToStorage };
