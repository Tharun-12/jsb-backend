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
const uploadDir = path.join(__dirname, "../uploads/programs");
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
    cb(null, "program-" + uniqueSuffix + ext);
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
// UPLOAD PROGRAM IMAGE
// ============================================================
router.post(
  "/upload/program-image",
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file uploaded",
        });
      }

      const imageUrl = `/uploads/programs/${req.file.filename}`;

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
// DELETE PROGRAM IMAGE
// ============================================================
router.delete("/programs/:id/image", async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT image FROM programs WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    const imagePath = existing[0].image;

    if (imagePath) {
      const filename = path.basename(imagePath);
      const filePath = path.join(__dirname, "../uploads/programs", filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.query("UPDATE programs SET image = NULL WHERE id = ?", [id]);

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
// GET all programs with optional filtering
// ============================================================
router.get("/programs", async (req, res) => {
  try {
    const { service_id, status } = req.query;
    
    let query = `
      SELECT 
        p.*,
        s.name as service_name,
        s.service_for
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (service_id) {
      query += " AND p.service_id = ?";
      params.push(service_id);
    }

    if (status !== undefined) {
      query += " AND p.status = ?";
      params.push(status === "true" ? 1 : 0);
    }

    query += " ORDER BY p.id DESC";

    const [rows] = await db.query(query, params);
    
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Error fetching programs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch programs",
      error: error.message,
    });
  }
});

// ============================================================
// GET single program by ID
// ============================================================
router.get("/programs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT 
        p.*,
        s.name as service_name,
        s.service_for
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Error fetching program:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch program",
      error: error.message,
    });
  }
});

// ============================================================
// POST create new program
// ============================================================
router.post("/programs", async (req, res) => {
  try {
    const { service_id, title, description, image, status } = req.body;

    // Validation
    if (!service_id) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Program title is required",
      });
    }

    // Check if service exists
    const [serviceCheck] = await db.query(
      "SELECT id FROM services WHERE id = ?",
      [service_id]
    );

    if (serviceCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service_id. Service does not exist.",
      });
    }

    const [result] = await db.query(
      `INSERT INTO programs 
       (service_id, title, description, image, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        service_id,
        title.trim(),
        description ? description.trim() : null,
        image ? image.trim() : null,
        status !== undefined ? (status ? 1 : 0) : 1,
      ]
    );

    // Get the newly created program
    const [newProgram] = await db.query(
      `SELECT 
        p.*,
        s.name as service_name,
        s.service_for
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Program created successfully",
      data: newProgram[0],
    });
  } catch (error) {
    console.error("Error creating program:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create program",
      error: error.message,
    });
  }
});

// ============================================================
// PUT update program
// ============================================================
router.put("/programs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { service_id, title, description, image, status } = req.body;

    // Check if program exists
    const [existing] = await db.query(
      "SELECT * FROM programs WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    // Validation
    if (!service_id) {
      return res.status(400).json({
        success: false,
        message: "Service ID is required",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Program title is required",
      });
    }

    // Check if service exists
    const [serviceCheck] = await db.query(
      "SELECT id FROM services WHERE id = ?",
      [service_id]
    );

    if (serviceCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid service_id. Service does not exist.",
      });
    }

    await db.query(
      `UPDATE programs 
       SET service_id = ?, 
           title = ?, 
           description = ?, 
           image = ?, 
           status = ? 
       WHERE id = ?`,
      [
        service_id,
        title.trim(),
        description ? description.trim() : null,
        image ? image.trim() : null,
        status !== undefined ? (status ? 1 : 0) : 1,
        id,
      ]
    );

    // Get the updated program
    const [updatedProgram] = await db.query(
      `SELECT 
        p.*,
        s.name as service_name,
        s.service_for
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "Program updated successfully",
      data: updatedProgram[0],
    });
  } catch (error) {
    console.error("Error updating program:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update program",
      error: error.message,
    });
  }
});

// ============================================================
// PATCH update program status
// ============================================================
router.patch("/programs/:id/status", async (req, res) => {
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
      "SELECT * FROM programs WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    await db.query(
      "UPDATE programs SET status = ? WHERE id = ?",
      [status ? 1 : 0, id]
    );

    const [updatedProgram] = await db.query(
      `SELECT 
        p.*,
        s.name as service_name,
        s.service_for
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      WHERE p.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "Program status updated successfully",
      data: updatedProgram[0],
    });
  } catch (error) {
    console.error("Error updating program status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update program status",
      error: error.message,
    });
  }
});

// ============================================================
// DELETE program
// ============================================================
router.delete("/programs/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT image FROM programs WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Program not found",
      });
    }

    const imagePath = existing[0].image;

    await db.query("DELETE FROM programs WHERE id = ?", [id]);

    // Delete image file from server if exists
    if (imagePath) {
      const filename = path.basename(imagePath);
      const filePath = path.join(__dirname, "../uploads/programs", filename);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({
      success: true,
      message: "Program deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting program:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete program",
      error: error.message,
    });
  }
});

// ============================================================
// Bulk delete programs
// ============================================================
router.delete("/programs/bulk", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid program IDs array is required",
      });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [programsToDelete] = await db.query(
      `SELECT image FROM programs WHERE id IN (${placeholders})`,
      ids
    );

    const [result] = await db.query(
      `DELETE FROM programs WHERE id IN (${placeholders})`,
      ids
    );

    // Delete image files from server
    programsToDelete.forEach(program => {
      if (program.image) {
        const filename = path.basename(program.image);
        const filePath = path.join(__dirname, "../uploads/programs", filename);
        
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    res.json({
      success: true,
      message: `${result.affectedRows} program(s) deleted successfully`,
      deletedCount: result.affectedRows,
    });
  } catch (error) {
    console.error("Error bulk deleting programs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete programs",
      error: error.message,
    });
  }
});

// ============================================================
// GET program statistics
// ============================================================
router.get("/programs/stats", async (req, res) => {
  try {
    // Total count
    const [totalResult] = await db.query(
      "SELECT COUNT(*) as total FROM programs"
    );
    
    // Count by service
    const [byServiceResult] = await db.query(
      `SELECT 
        s.name as service_name,
        COUNT(p.id) as count 
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      GROUP BY p.service_id`
    );
    
    // Count by status
    const [byStatusResult] = await db.query(
      "SELECT status, COUNT(*) as count FROM programs GROUP BY status"
    );

    // Recent programs
    const [recentResult] = await db.query(
      `SELECT 
        p.*,
        s.name as service_name
      FROM programs p
      LEFT JOIN services s ON p.service_id = s.id
      ORDER BY p.created_at DESC 
      LIMIT 5`
    );

    res.json({
      success: true,
      data: {
        total: totalResult[0]?.total || 0,
        byService: byServiceResult,
        byStatus: byStatusResult,
        recent: recentResult,
      },
    });
  } catch (error) {
    console.error("Error fetching program stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
});

// GET API endpoint to combine services and programs
router.get('/services-with-programs', async (req, res) => {
    try {
        const query = `
            SELECT 
                s.id AS service_id,
                s.service_for,
                s.name AS service_name,
                p.*
            FROM services s
            LEFT JOIN programs p ON s.id = p.service_id
            ORDER BY s.id, p.id
        `;
        
        const [results] = await db.query(query);
        
        // Transform data to group programs under each service
        const combinedData = results.reduce((acc, row) => {
            // Check if service already exists in accumulator
            let service = acc.find(s => s.id === row.service_id);
            
            if (!service) {
                // Create new service entry
                service = {
                    id: row.service_id,
                    service_for: row.service_for,
                    name: row.service_name,
                    programs: []
                };
                acc.push(service);
            }
            
            // Add program if it exists (not null)
            if (row.id) { // program id exists
                const { service_id, service_for, service_name, ...programData } = row;
                service.programs.push(programData);
            }
            
            return acc;
        }, []);
        
        res.status(200).json({
            success: true,
            data: combinedData
        });
        
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching data from database',
            error: error.message
        });
    }
});

module.exports = router;