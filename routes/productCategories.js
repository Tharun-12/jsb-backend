const express = require("express");
const router = express.Router();
const db = require("../db");

// =====================================================
// GET ALL CATEGORIES
// =====================================================
router.get("/categories", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, created_at, updated_at FROM product_categories ORDER BY id DESC"
    );

    // Format the response to match frontend expectations
    const categories = rows.map(category => ({
      id: category.id,
      name: category.name,
      // productCount will be 0 since we only store categories
      productCount: 0,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }));

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message
    });
  }
});

// =====================================================
// GET SINGLE CATEGORY BY ID
// =====================================================
router.get("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT id, name, created_at, updated_at FROM product_categories WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const category = {
      id: rows[0].id,
      name: rows[0].name,
      productCount: 0,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };

    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
      error: error.message
    });
  }
});

// =====================================================
// CREATE NEW CATEGORY
// =====================================================
router.post("/categories", async (req, res) => {
  try {
    const { name } = req.body;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    const trimmedName = name.trim();

    // Check if category already exists
    const [existing] = await db.query(
      "SELECT id FROM product_categories WHERE name = ?",
      [trimmedName]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Category with this name already exists"
      });
    }

    // Insert new category
    const [result] = await db.query(
      "INSERT INTO product_categories (name) VALUES (?)",
      [trimmedName]
    );

    // Fetch the newly created category
    const [newCategory] = await db.query(
      "SELECT id, name, created_at, updated_at FROM product_categories WHERE id = ?",
      [result.insertId]
    );

    const category = {
      id: newCategory[0].id,
      name: newCategory[0].name,
      productCount: 0,
      createdAt: newCategory[0].created_at,
      updatedAt: newCategory[0].updated_at
    };

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category
    });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create category",
      error: error.message
    });
  }
});

// =====================================================
// UPDATE CATEGORY
// =====================================================
router.put("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required"
      });
    }

    const trimmedName = name.trim();

    // Check if category exists
    const [existing] = await db.query(
      "SELECT id FROM product_categories WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Check if another category with same name exists
    const [duplicate] = await db.query(
      "SELECT id FROM product_categories WHERE name = ? AND id != ?",
      [trimmedName, id]
    );

    if (duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Another category with this name already exists"
      });
    }

    // Update category
    await db.query(
      "UPDATE product_categories SET name = ? WHERE id = ?",
      [trimmedName, id]
    );

    // Fetch updated category
    const [updatedCategory] = await db.query(
      "SELECT id, name, created_at, updated_at FROM product_categories WHERE id = ?",
      [id]
    );

    const category = {
      id: updatedCategory[0].id,
      name: updatedCategory[0].name,
      productCount: 0,
      createdAt: updatedCategory[0].created_at,
      updatedAt: updatedCategory[0].updated_at
    };

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category
    });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update category",
      error: error.message
    });
  }
});

// =====================================================
// DELETE CATEGORY
// =====================================================
router.delete("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category exists
    const [existing] = await db.query(
      "SELECT id, name FROM product_categories WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    // Delete category
    await db.query(
      "DELETE FROM product_categories WHERE id = ?",
      [id]
    );

    res.json({
      success: true,
      message: "Category deleted successfully",
      data: {
        id: parseInt(id),
        name: existing[0].name
      }
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message
    });
  }
});

// =====================================================
// BULK DELETE CATEGORIES (Optional)
// =====================================================
router.delete("/categories/bulk", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Valid category IDs array is required"
      });
    }

    // Create placeholders for the query
    const placeholders = ids.map(() => '?').join(',');
    
    const [result] = await db.query(
      `DELETE FROM product_categories WHERE id IN (${placeholders})`,
      ids
    );

    res.json({
      success: true,
      message: `${result.affectedRows} categories deleted successfully`,
      data: {
        deletedCount: result.affectedRows
      }
    });
  } catch (error) {
    console.error("Error deleting categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete categories",
      error: error.message
    });
  }
});

module.exports = router;