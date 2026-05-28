const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const controller = require('../controllers/vehicleReportController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

const uploadDir = path.join(__dirname, '../../../uploads/vehicle-reports');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.use(authenticate);

router.post('/',               authorize('driver'), upload.array('photos', 5),          controller.create);
router.get('/',                authorize('owner'),  controller.getAll);
router.get('/my',              authorize('driver'), controller.getMyReports);
router.put('/:id/status',      authorize('owner'),  controller.updateStatus);
router.put('/:id/progress',    authorize('driver'), upload.array('progress_photos', 5), controller.submitProgress);

module.exports = router;
