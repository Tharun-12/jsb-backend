// routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Adjust based on your DB setup

const multer = require('multer');
const path = require('path');
const fs = require('fs');

/* =====================================================
   MAKE SURE THE UPLOAD DIRECTORY EXISTS
   Multer will NOT create this folder for you. If it's
   missing, every upload silently fails with an ENOENT
   error, which is the #1 cause of "Failed to upload logo".
====================================================== */
const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // absolute path, guaranteed to exist
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed'));
  },
});

/* =====================================================
   POST /api/upload-logo
====================================================== */
router.post('/upload-logo', (req, res) => {
  upload.single('logo')(req, res, function (err) {
    // Handle multer-specific errors (file too large, bad type, missing dir, etc.)
    if (err instanceof multer.MulterError) {
      console.error('Multer error uploading logo:', err);
      return res.status(400).json({
        success: false,
        message:
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Logo file is too large. Max size is 5MB.'
            : err.message,
      });
    }
    if (err) {
      console.error('Error uploading logo:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to upload logo',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    res.status(200).json({
      success: true,
      logoUrl: logoUrl,
    });
  });
});

/* =====================================================
   GET /api/settings
====================================================== */
router.get('/settings', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM settings LIMIT 1');

    if (rows.length === 0) {
      return res.status(200).json({
        logo: null,
        companyName: '',
        contactEmail: '',
        phone: '',
        address: '',
        googleMapsUrl: '',
      });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
    });
  }
});

/* =====================================================
   PUT /api/settings  (create-or-update, "upsert")
====================================================== */
router.put('/settings', async (req, res) => {
  try {
    const { logo, companyName, contactEmail, phone, address, googleMapsUrl } =
      req.body;

    if (!companyName || !contactEmail || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, phone, and address are required',
      });
    }

    const [existing] = await db.query('SELECT id FROM settings LIMIT 1');

    if (existing.length === 0) {
      const query = `
        INSERT INTO settings
        (logo, companyName, contactEmail, phone, address, googleMapsUrl)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      await db.query(query, [
        logo || null,
        companyName,
        contactEmail,
        phone,
        address,
        googleMapsUrl || null,
      ]);
    } else {
      const query = `
        UPDATE settings
        SET
          logo = ?,
          companyName = ?,
          contactEmail = ?,
          phone = ?,
          address = ?,
          googleMapsUrl = ?,
          updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await db.query(query, [
        logo || null,
        companyName,
        contactEmail,
        phone,
        address,
        googleMapsUrl || null,
        existing[0].id,
      ]);
    }

    const [updatedSettings] = await db.query('SELECT * FROM settings LIMIT 1');

    res.status(200).json({
      success: true,
      message: 'Settings saved successfully',
      data: updatedSettings[0],
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save settings',
    });
  }
});

/* =====================================================
   POST /api/settings  (create only — kept for completeness,
   though PUT above already handles first-time creation)
====================================================== */
router.post('/settings', async (req, res) => {
  try {
    const { logo, companyName, contactEmail, phone, address, googleMapsUrl } =
      req.body;

    if (!companyName || !contactEmail || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Company name, email, phone, and address are required',
      });
    }

    const [existing] = await db.query('SELECT id FROM settings LIMIT 1');

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Settings already exist. Use PUT to update.',
      });
    }

    const query = `
      INSERT INTO settings
      (logo, companyName, contactEmail, phone, address, googleMapsUrl)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [
      logo || null,
      companyName,
      contactEmail,
      phone,
      address,
      googleMapsUrl || null,
    ]);

    const [newSettings] = await db.query(
      'SELECT * FROM settings WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Settings created successfully',
      data: newSettings[0],
    });
  } catch (error) {
    console.error('Error creating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create settings',
    });
  }
});

module.exports = router;