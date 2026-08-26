const db = require("../db");

const globalSearch = async (req, res) => {
  try {
    const search = req.query.q;

    // ==================================================
    // EMPTY SEARCH
    // ==================================================

    if (!search || !search.trim()) {
      return res.status(200).json({
        success: true,
        query: "",
        results: {
          pages: [],
          sections: [],
          blogs: [],
          services: [],
          programs: [],
          enquiries: [],
          productCategories: [],
          products: [],
          packageCategories: [],
          packages: []
        }
      });
    }

    const searchTerm = `%${search.trim()}%`;

    // ==================================================
    // 1. PAGES
    // ==================================================

    const [pages] = await db.query(
      `
      SELECT
        id,
        name,
        slug,
        status
      FROM pages
      WHERE
        name LIKE ?
        OR slug LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 2. SECTIONS
    // ==================================================

    const [sections] = await db.query(
      `
      SELECT
        id,
        page,
        page_slug,
        title,
        type,
        display_order,
        status
      FROM sections
      WHERE
        page LIKE ?
        OR page_slug LIKE ?
        OR title LIKE ?
        OR type LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 3. BLOGS
    // ==================================================

    const [blogs] = await db.query(
      `
      SELECT
        id,
        title,
        slug,
        content,
        image,
        category,
        status,
        created_date,
        author,
        tag_line,
        read_time
      FROM blogs
      WHERE
        title LIKE ?
        OR slug LIKE ?
        OR content LIKE ?
        OR category LIKE ?
        OR author LIKE ?
        OR tag_line LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 4. SERVICES
    // ==================================================

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
      [
        searchTerm,
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 5. PROGRAMS
    // ==================================================

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
      [
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 6. ENQUIRIES
    // ==================================================

    const [enquiries] = await db.query(
      `
      SELECT
        id,
        name,
        email,
        mobile,
        type,
        team_size,
        status,
        enquiry_date
      FROM enquiries
      WHERE
        name LIKE ?
        OR email LIKE ?
        OR mobile LIKE ?
        OR type LIKE ?
        OR status LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 7. PRODUCT CATEGORIES
    // ==================================================

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
      [
        searchTerm
      ]
    );

    // ==================================================
    // 8. PRODUCTS
    // ==================================================

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
        OR CAST(price AS CHAR) LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm,
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // 9. PACKAGE CATEGORIES
    // ==================================================

    const [packageCategories] = await db.query(
      `
      SELECT
        id,
        name
      FROM package_categories
      WHERE
        name LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm
      ]
    );

    // ==================================================
    // 10. PACKAGES
    // ==================================================

    const [packages] = await db.query(
      `
      SELECT
        id,
        name,
        category,
        description,
        image,
        price,
        status
      FROM packages
      WHERE
        name LIKE ?
        OR category LIKE ?
        OR description LIKE ?
        OR CAST(price AS CHAR) LIKE ?
      ORDER BY id DESC
      LIMIT 5
      `,
      [
        searchTerm,
        searchTerm,
        searchTerm,
        searchTerm
      ]
    );

    // ==================================================
    // RESPONSE
    // ==================================================

    return res.status(200).json({
      success: true,
      query: search.trim(),

      results: {
        pages,
        sections,
        blogs,
        services,
        programs,
        enquiries,
        productCategories,
        products,
        packageCategories,
        packages
      }
    });

  } catch (error) {
    console.error(
      "Global Search Error:",
      error
    );

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