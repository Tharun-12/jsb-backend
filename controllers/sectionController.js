const db = require("../db");

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
    const { page, pageSlug, title, type, order, status } = req.body;

    if (!page || !pageSlug || !title || !type) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const [result] = await db.query(
      "INSERT INTO sections (page, page_slug, title, type, display_order, status) VALUES (?, ?, ?, ?, ?, ?)",
      [page, pageSlug, title.trim(), type, Number(order) || 1, status ? 1 : 0]
    );

    const [rows] = await db.query("SELECT * FROM sections WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, data: mapSection(rows[0]) });
  } catch (err) {
    console.error("createSection error:", err);
    res.status(500).json({ success: false, message: "Failed to create section" });
  }
};

// PUT /api/sections/:id
exports.updateSection = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, pageSlug, title, type, order, status } = req.body;

    await db.query(
      "UPDATE sections SET page = ?, page_slug = ?, title = ?, type = ?, display_order = ?, status = ? WHERE id = ?",
      [page, pageSlug, title.trim(), type, Number(order) || 1, status ? 1 : 0, id]
    );

    const [rows] = await db.query("SELECT * FROM sections WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Section not found" });
    }
    res.json({ success: true, data: mapSection(rows[0]) });
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