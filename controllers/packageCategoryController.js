const db = require("../db");

const CATEGORY_COLUMNS = "id, name, created_at, updated_at";

/* =====================================================
   GET ALL CATEGORIES
====================================================== */
const getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ${CATEGORY_COLUMNS}
         FROM package_categories
        ORDER BY id ASC`
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllCategories error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch categories" });
  }
};

/* =====================================================
   GET SINGLE CATEGORY
====================================================== */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT ${CATEGORY_COLUMNS}
         FROM package_categories
        WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getCategoryById error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch category" });
  }
};

/* =====================================================
   CREATE CATEGORY
====================================================== */
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    const trimmedName = name.trim();

    const [existing] = await db.query(
      `SELECT id FROM package_categories WHERE name = ?`,
      [trimmedName]
    );

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Category already exists" });
    }

    const [result] = await db.query(
      `INSERT INTO package_categories (name) VALUES (?)`,
      [trimmedName]
    );

    // Return the real row so the UI gets the true created_at / updated_at
    const [created] = await db.query(
      `SELECT ${CATEGORY_COLUMNS}
         FROM package_categories
        WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: created[0],
    });
  } catch (err) {
    console.error("createCategory error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to create category" });
  }
};

/* =====================================================
   UPDATE CATEGORY
   Packages reference the category by id, so renaming here
   is automatically reflected in every package.
====================================================== */
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const [existing] = await db.query(
      `SELECT id FROM package_categories WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    const trimmedName = name.trim();

    const [duplicate] = await db.query(
      `SELECT id FROM package_categories WHERE name = ? AND id != ?`,
      [trimmedName, id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Another category already uses this name",
      });
    }

    await db.query(`UPDATE package_categories SET name = ? WHERE id = ?`, [
      trimmedName,
      id,
    ]);

    const [updated] = await db.query(
      `SELECT ${CATEGORY_COLUMNS}
         FROM package_categories
        WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: "Category updated successfully",
      data: updated[0],
    });
  } catch (err) {
    console.error("updateCategory error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update category" });
  }
};

/* =====================================================
   DELETE CATEGORY
   Blocked while packages still use the category.
====================================================== */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT id FROM package_categories WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const [[usage]] = await db.query(
      `SELECT COUNT(*) AS total FROM packages WHERE category_id = ?`,
      [id]
    );

    if (usage.total > 0) {
      return res.status(409).json({
        success: false,
        message: `This category is used by ${usage.total} package${
          usage.total > 1 ? "s" : ""
        }. Move or delete those packages first.`,
      });
    }

    await db.query(`DELETE FROM package_categories WHERE id = ?`, [id]);

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    console.error("deleteCategory error:", err);

    // Safety net in case the FK blocks the delete
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        success: false,
        message:
          "This category is used by one or more packages. Move or delete those packages first.",
      });
    }

    res
      .status(500)
      .json({ success: false, message: "Failed to delete category" });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};