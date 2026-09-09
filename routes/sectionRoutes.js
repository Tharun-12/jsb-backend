const express = require("express");
const router = express.Router();
const sectionController = require("../controllers/sectionController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Configure multer for gallery image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/gallery");
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `gallery-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.get("/", sectionController.getAllSections);
router.get("/:id", sectionController.getSectionById);
router.post("/", sectionController.createSection);
router.put("/:id", sectionController.updateSection);
router.patch("/:id/status", sectionController.toggleStatus);
router.delete("/:id", sectionController.deleteSection);

// Gallery routes
router.get("/:id/gallery", sectionController.getGalleryImages);
router.post("/:id/gallery", upload.array("images", 20), sectionController.uploadGalleryImages);
router.delete("/:id/gallery/:imageId", sectionController.deleteGalleryImage);
router.delete("/:id/gallery", sectionController.clearGallery);

// Content routes (keep for compatibility but not used in form)
router.get("/:id/content", sectionController.getContent);
router.put("/:id/content", sectionController.saveContent);
router.delete("/:id/content", sectionController.resetContent);

// Customization routes (keep for compatibility but not used in form)
router.get("/:id/customization", sectionController.getCustomization);
router.put("/:id/customization", sectionController.saveCustomization);
router.delete("/:id/customization", sectionController.resetCustomization);

module.exports = router;