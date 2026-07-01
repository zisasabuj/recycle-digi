const r      = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { protect } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '../../frontend/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random()*1e6) + path.extname(file.originalname))
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype)
      ? cb(null, true) : cb(new Error('Images only (jpg/png/webp/gif)'));
  }
});

// POST /api/upload  — single image
r.post('/',  protect, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success:false, message:'No file uploaded.' });
  res.json({ success:true, url: '/uploads/' + req.file.filename });
});

// POST /api/upload/multiple  — up to 5 images
r.post('/multiple', protect, upload.array('images', 5), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ success:false, message:'No files uploaded.' });
  res.json({ success:true, urls: req.files.map(f => '/uploads/' + f.filename) });
});

module.exports = r;
