const db = require("../db");

// =====================================================
// GET ALL PACKAGES
// =====================================================
exports.getAllPackages = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM packages ORDER BY id DESC"
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching packages:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch packages",
      error: err.message,
    });
  }
};

// =====================================================
// GET SINGLE PACKAGE
// =====================================================
exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error fetching package:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch package",
      error: err.message,
    });
  }
};

// =====================================================
// CREATE PACKAGE
// =====================================================
exports.createPackage = async (req, res) => {
  try {
    const { name, category, description, image, price, status } = req.body;

    if (!name || !category || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        message: "Name, category and price are required",
      });
    }

    const [result] = await db.query(
      `INSERT INTO packages (name, category, description, image, price, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        category,
        description || "",
        image || "",
        price,
        status === undefined ? 1 : status ? 1 : 0,
      ]
    );

    const [rows] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error creating package:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create package",
      error: err.message,
    });
  }
};

// =====================================================
// UPDATE PACKAGE
// =====================================================
exports.updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, image, price, status } = req.body;

    const [existing] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    await db.query(
      `UPDATE packages
       SET name = ?, category = ?, description = ?, image = ?, price = ?, status = ?
       WHERE id = ?`,
      [
        name,
        category,
        description || "",
        image || "",
        price,
        status ? 1 : 0,
        id,
      ]
    );

    const [rows] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error updating package:", err);
    res.status(500).json({
      success: false,
      message: "Failed to update package",
      error: err.message,
    });
  }
};

// =====================================================
// TOGGLE STATUS
// =====================================================
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const newStatus = existing[0].status ? 0 : 1;

    await db.query(
      "UPDATE packages SET status = ? WHERE id = ?",
      [newStatus, id]
    );

    const [rows] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [id]
    );

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("Error toggling status:", err);
    res.status(500).json({
      success: false,
      message: "Failed to toggle status",
      error: err.message,
    });
  }
};

// =====================================================
// DELETE PACKAGE
// =====================================================
exports.deletePackage = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT * FROM packages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    await db.query("DELETE FROM packages WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Package deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting package:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete package",
      error: err.message,
    });
  }
};