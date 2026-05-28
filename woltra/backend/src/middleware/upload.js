const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const FIELD_DIRS = {
  signature:        'uploads/signatures',
  loading_photo:    'uploads/loading',
  unloading_photo:  'uploads/unloading',
  delivery_photo:   'uploads/delivery',
  document_photos:  'uploads/documents',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, FIELD_DIRS[file.fieldname] || 'uploads/photos');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedTypes.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 }
});

module.exports = { upload };
