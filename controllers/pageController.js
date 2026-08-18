const db = require("../db");

// GET /api/pages
exports.getAllPages = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM pages ORDER BY id ASC");
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllPages error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch pages" });
  }
};


// GET /api/pages/:id - NEW FUNCTION
exports.getPageById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM pages WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getPageById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch page" });
  }
};

// POST /api/pages
exports.createPage = async (req, res) => {
  try {
    const { name, slug, status } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ success: false, message: "Name and slug are required" });
    }

    const [result] = await db.query(
      "INSERT INTO pages (name, slug, status) VALUES (?, ?, ?)",
      [name.trim(), slug.trim(), status ? 1 : 0]
    );

    const [rows] = await db.query("SELECT * FROM pages WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("createPage error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Slug already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create page" });
  }
};

// PUT /api/pages/:id  (used for edit form)
exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, status } = req.body;

    await db.query(
      "UPDATE pages SET name = ?, slug = ?, status = ? WHERE id = ?",
      [name.trim(), slug.trim(), status ? 1 : 0, id]
    );

    const [rows] = await db.query("SELECT * FROM pages WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("updatePage error:", err);
    res.status(500).json({ success: false, message: "Failed to update page" });
  }
};

// PATCH /api/pages/:id/status  (used for the toggle switch)
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT status FROM pages WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }

    const newStatus = rows[0].status ? 0 : 1;
    await db.query("UPDATE pages SET status = ? WHERE id = ?", [newStatus, id]);

    res.json({ success: true, data: { id: Number(id), status: !!newStatus } });
  } catch (err) {
    console.error("toggleStatus error:", err);
    res.status(500).json({ success: false, message: "Failed to toggle status" });
  }
};

// DELETE /api/pages/:id
exports.deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query("DELETE FROM pages WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }
    res.json({ success: true, message: "Page deleted" });
  } catch (err) {
    console.error("deletePage error:", err);
    res.status(500).json({ success: false, message: "Failed to delete page" });
  }
};