const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const blogController = require("../controllers/blogController");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../uploads/blogs");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for multiple file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `blog-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed"));
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
  fileFilter: fileFilter,
});

// Routes
router.get("/", blogController.getAllBlogs);
router.get("/:id", blogController.getBlogById);

router.post(
  "/",
  upload.fields([
    { name: "featured_image", maxCount: 1 },
    { name: "gallery_images", maxCount: 20 },
  ]),
  blogController.createBlog
);

router.put(
  "/:id",
  upload.fields([
    { name: "featured_image", maxCount: 1 },
    { name: "gallery_images", maxCount: 20 },
  ]),
  blogController.updateBlog
);

router.patch("/:id/status", blogController.toggleStatus);
router.delete("/:id", blogController.deleteBlog);

// Delete individual image (gallery or a demoted former-cover image)
router.delete("/image/:imageId", blogController.deleteGalleryImage);

module.exports = router;