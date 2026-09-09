const db = require("../db");
const fs = require("fs");
const path = require("path");

// GET /api/sections
exports.getAllSections = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM sections ORDER BY page_slug ASC, display_order ASC");
    const mapped = rows.map(mapSection);
    res.json({ success: true, data: mapped });
  } catch (err) {
    console.error("getAllSections error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch sections" });
  }
};

// GET /api/sections/:id
exports.getSectionById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM sections WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    res.json({ success: true, data: mapSection(rows[0]) });
  } catch (err) {
    console.error("getSectionById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch section" });
  }
};

// POST /api/sections
exports.createSection = async (req, res) => {
  try {
    const { page, pageSlug, title, type, status } = req.body;

    console.log("Creating section with data:", req.body);

    if (!page || !pageSlug || !title || !type) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Get max display_order for the page
    const [maxOrderRows] = await db.query(
      "SELECT MAX(display_order) as maxOrder FROM sections WHERE page_slug = ?",
      [pageSlug]
    );
    const displayOrder = (maxOrderRows[0]?.maxOrder || 0) + 1;

    const [result] = await db.query(
      "INSERT INTO sections (page, page_slug, title, type, display_order, status) VALUES (?, ?, ?, ?, ?, ?)",
      [page, pageSlug, title.trim(), type, displayOrder, status ? 1 : 0]
    );

    const [rows] = await db.query("SELECT * FROM sections WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, data: mapSection(rows[0]) });
  } catch (err) {
    console.error("createSection error:", err);
    res.status(500).json({ success: false, message: "Failed to create section" });
  }
};

// PUT /api/sections/:id - FIXED to properly handle "Other" type
exports.updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, pageSlug, title, type, status } = req.body;

    console.log("Updating section with data:", req.body);
    console.log("Type received:", type);

    // Validate required fields
    if (!page || !pageSlug || !title || !type) {
      console.log("Missing required fields:", { page, pageSlug, title, type });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Check if section exists
    const [existing] = await db.query("SELECT * FROM sections WHERE id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    // Update the section - explicitly set type field
    const updateQuery = `
      UPDATE sections 
      SET page = ?, 
          page_slug = ?, 
          title = ?, 
          type = ?, 
          status = ? 
      WHERE id = ?
    `;
    
    const updateValues = [page, pageSlug, title.trim(), type, status ? 1 : 0, id];
    
    console.log("Update query:", updateQuery);
    console.log("Update values:", updateValues);

    await db.query(updateQuery, updateValues);

    // Fetch the updated section
    const [rows] = await db.query("SELECT * FROM sections WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    
    const updatedSection = mapSection(rows[0]);
    console.log("Updated section:", updatedSection);
    
    res.json({ success: true, data: updatedSection });
  } catch (err) {
    console.error("updateSection error:", err);
    res.status(500).json({ success: false, message: "Failed to update section" });
  }
};

// PATCH /api/sections/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT status FROM sections WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }

    const newStatus = rows[0].status ? 0 : 1;
    await db.query("UPDATE sections SET status = ? WHERE id = ?", [newStatus, id]);

    res.json({ success: true, data: { id: Number(id), status: !!newStatus } });
  } catch (err) {
    console.error("toggleStatus error:", err);
    res.status(500).json({ success: false, message: "Failed to toggle status" });
  }
};

// DELETE /api/sections/:id
exports.deleteSection = async (req, res) => {
  try {
    // Delete gallery images first
    await db.query("DELETE FROM section_gallery WHERE section_id = ?", [req.params.id]);
    
    const [result] = await db.query("DELETE FROM sections WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    res.json({ success: true, message: "Section deleted" });
  } catch (err) {
    console.error("deleteSection error:", err);
    res.status(500).json({ success: false, message: "Failed to delete section" });
  }
};

// ================= GALLERY =================

// GET /api/sections/:id/gallery
exports.getGalleryImages = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM section_gallery WHERE section_id = ? ORDER BY display_order ASC",
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getGalleryImages error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch gallery images" });
  }
};

// POST /api/sections/:id/gallery
exports.uploadGalleryImages = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No images uploaded" });
    }

    const insertedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = `/uploads/gallery/${file.filename}`;
      
      // Get max display_order for this section
      const [maxOrderRows] = await db.query(
        "SELECT MAX(display_order) as maxOrder FROM section_gallery WHERE section_id = ?",
        [id]
      );
      const displayOrder = (maxOrderRows[0]?.maxOrder || 0) + 1;

      const [result] = await db.query(
        "INSERT INTO section_gallery (section_id, image_url, display_order) VALUES (?, ?, ?)",
        [id, imageUrl, displayOrder]
      );

      insertedImages.push({
        id: result.insertId,
        image_url: imageUrl,
        display_order: displayOrder
      });
    }

    res.status(201).json({
      success: true,
      message: `${insertedImages.length} image(s) uploaded successfully`,
      data: insertedImages
    });
  } catch (err) {
    console.error("uploadGalleryImages error:", err);
    res.status(500).json({ success: false, message: "Failed to upload gallery images" });
  }
};

// DELETE /api/sections/:id/gallery/:imageId
exports.deleteGalleryImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    // Get image info first
    const [rows] = await db.query(
      "SELECT image_url FROM section_gallery WHERE id = ? AND section_id = ?",
      [imageId, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Gallery image not found" });
    }

    // Delete physical file
    const imagePath = path.join(__dirname, "..", rows[0].image_url);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Delete from database
    await db.query("DELETE FROM section_gallery WHERE id = ? AND section_id = ?", [imageId, id]);

    res.json({ success: true, message: "Gallery image deleted successfully" });
  } catch (err) {
    console.error("deleteGalleryImage error:", err);
    res.status(500).json({ success: false, message: "Failed to delete gallery image" });
  }
};

// DELETE /api/sections/:id/gallery
exports.clearGallery = async (req, res) => {
  try {
    const { id } = req.params;

    // Get all image URLs
    const [rows] = await db.query(
      "SELECT image_url FROM section_gallery WHERE section_id = ?",
      [id]
    );

    // Delete physical files
    rows.forEach(row => {
      const imagePath = path.join(__dirname, "..", row.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });

    // Delete from database
    await db.query("DELETE FROM section_gallery WHERE section_id = ?", [id]);

    res.json({ success: true, message: "All gallery images cleared" });
  } catch (err) {
    console.error("clearGallery error:", err);
    res.status(500).json({ success: false, message: "Failed to clear gallery images" });
  }
};

// ================= CONTENT =================

// GET /api/sections/:id/content
exports.getContent = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM section_content WHERE section_id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }
    const row = rows[0];
    res.json({
      success: true,
      data: {
        heading: row.heading || "",
        description: row.description || "",
        mainImage: row.main_image || "",
        layout: row.layout || "3 Columns",
        items: row.items ? JSON.parse(row.items) : [],
      },
    });
  } catch (err) {
    console.error("getContent error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch content" });
  }
};

// PUT /api/sections/:id/content
exports.saveContent = async (req, res) => {
  try {
    const { id } = req.params;
    const { heading, description, mainImage, layout, items } = req.body;

    await db.query(
      `INSERT INTO section_content (section_id, heading, description, main_image, layout, items)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE heading = VALUES(heading), description = VALUES(description),
         main_image = VALUES(main_image), layout = VALUES(layout), items = VALUES(items)`,
      [id, heading || "", description || "", mainImage || "", layout || "3 Columns", JSON.stringify(items || [])]
    );

    res.json({ success: true, message: "Content saved" });
  } catch (err) {
    console.error("saveContent error:", err);
    res.status(500).json({ success: false, message: "Failed to save content" });
  }
};

// DELETE /api/sections/:id/content
exports.resetContent = async (req, res) => {
  try {
    await db.query("DELETE FROM section_content WHERE section_id = ?", [req.params.id]);
    res.json({ success: true, message: "Content reset" });
  } catch (err) {
    console.error("resetContent error:", err);
    res.status(500).json({ success: false, message: "Failed to reset content" });
  }
};

// ================= CUSTOMIZATION =================

// GET /api/sections/:id/customization
exports.getCustomization = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM section_customizations WHERE section_id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }
    res.json({ success: true, data: JSON.parse(rows[0].settings) });
  } catch (err) {
    console.error("getCustomization error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch customization" });
  }
};

// PUT /api/sections/:id/customization
exports.saveCustomization = async (req, res) => {
  try {
    const { id } = req.params;
    const settings = req.body;

    await db.query(
      `INSERT INTO section_customizations (section_id, settings)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE settings = VALUES(settings)`,
      [id, JSON.stringify(settings)]
    );

    res.json({ success: true, message: "Customization saved" });
  } catch (err) {
    console.error("saveCustomization error:", err);
    res.status(500).json({ success: false, message: "Failed to save customization" });
  }
};

// DELETE /api/sections/:id/customization
exports.resetCustomization = async (req, res) => {
  try {
    await db.query("DELETE FROM section_customizations WHERE section_id = ?", [req.params.id]);
    res.json({ success: true, message: "Customization reset" });
  } catch (err) {
    console.error("resetCustomization error:", err);
    res.status(500).json({ success: false, message: "Failed to reset customization" });
  }
};

// helper
function mapSection(row) {
  return {
    id: row.id,
    page: row.page,
    pageSlug: row.page_slug,
    title: row.title,
    type: row.type,
    order: row.display_order,
    status: !!row.status,
  };
}