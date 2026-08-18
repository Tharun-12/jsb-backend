const db = require("../db");

const globalSearch = async (req, res) => {
  try {
    const search = req.query.q;

    if (!search || !search.trim()) {
      return res.status(200).json({
        success: true,
        query: "",
        results: {
          services: [],
          programs: [],
          productCategories: [],
          products: []
        }
      });
    }

    const searchTerm = `%${search.trim()}%`;

    // --------------------------------------------------
    // 1. SERVICES
    // --------------------------------------------------

    const [services] = await db.query(
      `
      SELECT
        id,
        name,
        service_for,
        description,
        status
      FROM services
      WHERE
        name LIKE ?
        OR service_for LIKE ?
        OR description LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [searchTerm, searchTerm, searchTerm]
    );

    // --------------------------------------------------
    // 2. PROGRAMS
    // --------------------------------------------------

    const [programs] = await db.query(
      `
      SELECT
        id,
        service_id,
        title,
        description,
        status
      FROM programs
      WHERE
        title LIKE ?
        OR description LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [searchTerm, searchTerm]
    );

    // --------------------------------------------------
    // 3. PRODUCT CATEGORIES
    // --------------------------------------------------

    const [productCategories] = await db.query(
      `
      SELECT
        id,
        name
      FROM product_categories
      WHERE
        name LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [searchTerm]
    );

    // --------------------------------------------------
    // 4. PRODUCTS
    // --------------------------------------------------

    const [products] = await db.query(
      `
      SELECT
        id,
        name,
        category_id,
        description,
        price,
        status
      FROM products
      WHERE
        name LIKE ?
        OR description LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [searchTerm, searchTerm]
    );

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      query: search.trim(),
      results: {
        services,
        programs,
        productCategories,
        products
      }
    });

  } catch (error) {
    console.error("Global Search Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to perform global search",
      error: error.message
    });
  }
};

module.exports = {
  globalSearch
};