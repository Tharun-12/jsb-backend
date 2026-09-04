const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/count/orders", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count FROM orders`
    );

    res.json({
      success: true,
      count: Number(rows[0].count),
    });
  } catch (error) {
    console.error("ORDERS COUNT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch orders count",
      error: error.message,
    });
  }
});


// ============================================================
// PACKAGES COUNT
// GET /api/packages/count
// ============================================================

router.get("/count/packages", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count FROM packages`
    );

    res.json({
      success: true,
      count: Number(rows[0].count),
    });
  } catch (error) {
    console.error("PACKAGES COUNT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch packages count",
      error: error.message,
    });
  }
});


// ============================================================
// PRODUCTS COUNT
// GET /api/products/count
// ============================================================

router.get("/count/products", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count FROM products`
    );

    res.json({
      success: true,
      count: Number(rows[0].count),
    });
  } catch (error) {
    console.error("PRODUCTS COUNT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products count",
      error: error.message,
    });
  }
});


// ============================================================
// ENQUIRIES COUNT
// GET /api/enquiries/count
// ============================================================

router.get("/count/enquiries", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count FROM enquiries`
    );

    res.json({
      success: true,
      count: Number(rows[0].count),
    });
  } catch (error) {
    console.error("ENQUIRIES COUNT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch enquiries count",
      error: error.message,
    });
  }
});

module.exports = router;