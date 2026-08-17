const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ============================================================
// MULTER CONFIGURATION FOR IMAGE UPLOADS
// ============================================================

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/services");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "service-" + uniqueSuffix + ext);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// ============================================================
// UPLOAD SERVICE IMAGE
// ============================================================
router.post(
  "/upload/service-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      // Construct the URL to access the uploaded image
      const imageUrl = `/uploads/services/${req.file.filename}`;

      res.json({
        success: true,
        message: "Image uploaded successfully",
        data: {
          url: imageUrl,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error: error.message,
      });
    }
  }
);

// ============================================================
// DELETE SERVICE IMAGE
// ============================================================
router.delete("/services/:id/image", async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT image FROM services WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const imagePath = existing[0].image;

    // Delete image file from server
    if (imagePath) {
      const filename = path.basename(imagePath);
      const filePath = path.join(__dirname, "../uploads/services", filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Update database to remove image reference
    await db.query("UPDATE services SET image = NULL WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete image",
      error: error.message,
    });
  }
});

// ============================================================
// GET all services with optional filtering
// ============================================================
router.get("/services", async (req, res) => {
  try {
    const { serviceFor, status } = req.query;
    
    let query = "SELECT * FROM services WHERE 1=1";
    const params = [];

    if (serviceFor) {
      query += " AND service_for = ?";
      params.push(serviceFor);
    }

    if (status !== undefined) {
      query += " AND status = ?";
      params.push(status === "true" ? 1 : 0);
    }

    query += " ORDER BY id DESC";

    const [rows] = await db.query(query, params);
    
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
      error: error.message,
    });
  }
});

// ============================================================
// GET single service by ID
// ============================================================
router.get("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch service",
      error: error.message,
    });
  }
});

// ============================================================
// POST create new service
// ============================================================
router.post("/services", async (req, res) => {
  try {
    const { serviceFor, name, description, image, status } = req.body;

    // Validation
    if (!serviceFor) {
      return res.status(400).json({
        success: false,
        message: "Service For is required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    // Validate service_for enum values
    const validServiceFor = ["Corporates", "For Students", "For Apartments"];
    if (!validServiceFor.includes(serviceFor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service_for value",
      });
    }

    const [result] = await db.query(
      `INSERT INTO services 
       (service_for, name, description, image, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        serviceFor,
        name.trim(),
        description ? description.trim() : null,
        image ? image.trim() : null,
        status !== undefined ? (status ? 1 : 0) : 1,
      ]
    );

    // Get the newly created service
    const [newService] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: newService[0],
    });
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create service",
      error: error.message,
    });
  }
});

// ============================================================
// PUT update service
// ============================================================
router.put("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceFor, name, description, image, status } = req.body;

    // Check if service exists
    const [existing] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Validation
    if (!serviceFor) {
      return res.status(400).json({
        success: false,
        message: "Service For is required",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    // Validate service_for enum values
    const validServiceFor = ["Corporates", "For Students", "For Apartments"];
    if (!validServiceFor.includes(serviceFor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service_for value",
      });
    }

    await db.query(
      `UPDATE services 
       SET service_for = ?, 
           name = ?, 
           description = ?, 
           image = ?, 
           status = ? 
       WHERE id = ?`,
      [
        serviceFor,
        name.trim(),
        description ? description.trim() : null,
        image ? image.trim() : null,
        status !== undefined ? (status ? 1 : 0) : 1,
        id,
      ]
    );

    // Get the updated service
    const [updatedService] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Service updated successfully",
      data: updatedService[0],
    });
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update service",
      error: error.message,
    });
  }
});

// ============================================================
// PATCH update service status
// ============================================================
router.patch("/services/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const [existing] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    await db.query(
      "UPDATE services SET status = ? WHERE id = ?",
      [status ? 1 : 0, id]
    );

    const [updatedService] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Service status updated successfully",
      data: updatedService[0],
    });
  } catch (error) {
    console.error("Error updating service status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update service status",
      error: error.message,
    });
  }
});

// ============================================================
// DELETE service
// ============================================================
router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Get image path before deleting the service
    const imagePath = existing[0].image;

    // Delete the service from database
    await db.query("DELETE FROM services WHERE id = ?", [id]);

    // Delete image file from server if exists
    if (imagePath) {
      const filename = path.basename(imagePath);
      const filePath = path.join(__dirname, "../uploads/services", filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete service",
      error: error.message,
    });
  }
});

// ============================================================
// Bulk delete services
// ============================================================
router.delete("/services/bulk", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid service IDs array is required",
      });
    }

    // Get images for services being deleted
    const placeholders = ids.map(() => "?").join(",");
    const [servicesToDelete] = await db.query(
      `SELECT image FROM services WHERE id IN (${placeholders})`,
      ids
    );

    // Delete services from database
    const [result] = await db.query(
      `DELETE FROM services WHERE id IN (${placeholders})`,
      ids
    );

    // Delete image files from server
    servicesToDelete.forEach(service => {
      if (service.image) {
        const filename = path.basename(service.image);
        const filePath = path.join(__dirname, "../uploads/services", filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    res.json({
      success: true,
      message: `${result.affectedRows} service(s) deleted successfully`,
      deletedCount: result.affectedRows,
    });
  } catch (error) {
    console.error("Error bulk deleting services:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete services",
      error: error.message,
    });
  }
});

// ============================================================
// GET service statistics
// ============================================================
router.get("/services/stats", async (req, res) => {
  try {
    // Total count
    const [totalResult] = await db.query(
      "SELECT COUNT(*) as total FROM services"
    );
    
    // Count by service_for
    const [byTypeResult] = await db.query(
      "SELECT service_for, COUNT(*) as count FROM services GROUP BY service_for"
    );
    
    // Count by status
    const [byStatusResult] = await db.query(
      "SELECT status, COUNT(*) as count FROM services GROUP BY status"
    );

    // Recent services
    const [recentResult] = await db.query(
      "SELECT * FROM services ORDER BY created_at DESC LIMIT 5"
    );

    res.json({
      success: true,
      data: {
        total: totalResult[0]?.total || 0,
        byType: byTypeResult,
        byStatus: byStatusResult,
        recent: recentResult,
      },
    });
  } catch (error) {
    console.error("Error fetching service stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
});

module.exports = router;