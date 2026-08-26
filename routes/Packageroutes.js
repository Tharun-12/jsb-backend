const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  toggleStatus,
  deletePackage,
} = require("../controllers/packageController");

// =====================================================
// FILE UPLOAD CONFIGURATION
// =====================================================

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/packages");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, "package-" + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

router.get("/", getAllPackages);
router.get("/:id", getPackageById);
router.post("/", upload.array("images", 5), createPackage);
router.put("/:id", upload.array("images", 5), updatePackage);
router.patch("/:id/status", toggleStatus);
router.delete("/:id", deletePackage);

module.exports = router;