const db = require("../db");

/* =====================================================
   GET ALL CATEGORIES
====================================================== */
const getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, package_count AS packageCount
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
   GET SINGLE CATEGORY
====================================================== */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT id, name, package_count AS packageCount
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
   CREATE CATEGORY (UPDATED)
====================================================== */
const createCategory = async (req, res) => {
  try {
    const { name, packageCount } = req.body;

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }

    // Validate packageCount (optional, default to 0 if not provided)
    const count = packageCount !== undefined && !isNaN(packageCount) 
      ? parseInt(packageCount) 
      : 0;

    if (count < 0) {
      return res.status(400).json({ success: false, message: "Package count cannot be negative" });
    }

    // Check if category already exists
    const [existing] = await db.query(
      `SELECT id FROM package_categories WHERE name = ?`,
      [name.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Category already exists" });
    }

    // Insert with package count
    const [result] = await db.query(
      `INSERT INTO package_categories (name, package_count) VALUES (?, ?)`,
      [name.trim(), count]
    );

    res.status(201).json({
      success: true,
      data: { 
        id: result.insertId, 
        name: name.trim(), 
        packageCount: count 
      },
    });
  } catch (err) {
    console.error("createCategory error:", err);
    res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

/* =====================================================
   UPDATE CATEGORY (UPDATED)
====================================================== */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, packageCount } = req.body;

    // Check if category exists
    const [existing] = await db.query(
      `SELECT id FROM package_categories WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // Validate fields
    let updateFields = [];
    let updateValues = [];

    if (name !== undefined && name.trim()) {
      // Check for duplicate name
      const [duplicate] = await db.query(
        `SELECT id FROM package_categories WHERE name = ? AND id != ?`,
        [name.trim(), id]
      );

      if (duplicate.length > 0) {
        return res.status(409).json({ success: false, message: "Another category already uses this name" });
      }
      
      updateFields.push("name = ?");
      updateValues.push(name.trim());
    }

    if (packageCount !== undefined && !isNaN(packageCount)) {
      const count = parseInt(packageCount);
      if (count < 0) {
        return res.status(400).json({ success: false, message: "Package count cannot be negative" });
      }
      updateFields.push("package_count = ?");
      updateValues.push(count);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    // Add id to values
    updateValues.push(id);

    const query = `UPDATE package_categories SET ${updateFields.join(", ")} WHERE id = ?`;
    await db.query(query, updateValues);

    // Get updated data
    const [updated] = await db.query(
      `SELECT id, name, package_count AS packageCount 
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
   DELETE CATEGORY
====================================================== */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id, package_count AS packageCount FROM package_categories WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    if (rows[0].packageCount > 0) {
      return res.status(400).json({
        success: false,
        message: `This category contains ${rows[0].packageCount} packages. Please move or delete those packages before deleting the category.`,
      });
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