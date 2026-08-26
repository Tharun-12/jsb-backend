const db = require("../db");

/* =====================================================
   GET ALL CATEGORIES (UPDATED - removed package_count)
====================================================== */
const getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name
       FROM package_categories
       ORDER BY id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllCategories error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

/* =====================================================
   GET SINGLE CATEGORY (UPDATED - removed package_count)
====================================================== */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT id, name
       FROM package_categories WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getCategoryById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch category" });
  }
};

/* =====================================================
   CREATE CATEGORY (UPDATED - removed package_count)
====================================================== */
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // Check if category already exists
    const [existing] = await db.query(
      `SELECT id FROM package_categories WHERE name = ?`,
      [name.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Category already exists" });
    }

    // Insert without package count
    const [result] = await db.query(
      `INSERT INTO package_categories (name) VALUES (?)`,
      [name.trim()]
    );

    res.status(201).json({
      success: true,
      data: { 
        id: result.insertId, 
        name: name.trim()
      },
    });
  } catch (err) {
    console.error("createCategory error:", err);
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

/* =====================================================
   UPDATE CATEGORY (UPDATED - removed package_count)
====================================================== */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Check if category exists
    const [existing] = await db.query(
      `SELECT id FROM package_categories WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // Check for duplicate name
    const [duplicate] = await db.query(
      `SELECT id FROM package_categories WHERE name = ? AND id != ?`,
      [name.trim(), id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({ success: false, message: "Another category already uses this name" });
    }

    await db.query(
      `UPDATE package_categories SET name = ? WHERE id = ?`,
      [name.trim(), id]
    );

    // Get updated data
    const [updated] = await db.query(
      `SELECT id, name
       FROM package_categories WHERE id = ?`,
      [id]
    );

    res.json({ success: true, data: updated[0] });
  } catch (err) {
    console.error("updateCategory error:", err);
    res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

/* =====================================================
   DELETE CATEGORY (UPDATED - removed package_count check)
====================================================== */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id FROM package_categories WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    await db.query(`DELETE FROM package_categories WHERE id = ?`, [id]);

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    console.error("deleteCategory error:", err);
    res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};