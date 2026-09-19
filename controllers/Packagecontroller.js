const db = require("../db");
const path = require("path");
const fs = require("fs");

// =====================================================
// HELPERS
// =====================================================

const parseStatus = (status) => {
  if (status === undefined || status === null) {
    return true;
  }

  return (
    status === true ||
    status === 1 ||
    status === "1" ||
    status === "true"
  );
};

const parsePositiveInteger = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

// Parses a JSON string (or an already-parsed array) into an array
const parseJsonList = (value) => {
  if (!value) return [];

  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

const deleteFileIfExists = (relativeUrl) => {
  if (!relativeUrl) return;

  const filePath = path.join(__dirname, "../", relativeUrl);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// =====================================================
// SHARED SQL
//
// The category NAME always comes from package_categories
// via a JOIN on category_id. Renaming a category is
// therefore reflected everywhere immediately.
// =====================================================

const PACKAGE_COLUMNS = `
  p.id,
  p.name,
  p.category_id,
  c.name AS category,
  p.description,
  p.image,
  p.price,
  p.guest_count,
  p.read_time,
  p.status,
  p.created_at,
  p.updated_at
`;

// Loads one package (with its category name and images) in the shape the
// frontend expects. Used by getById, create and update.
const buildPackageData = async (conn, id) => {
  const [packageRows] = await conn.query(
    `SELECT
       ${PACKAGE_COLUMNS},
       (SELECT image_url
          FROM package_images
         WHERE package_id = p.id
           AND is_primary = 1
         LIMIT 1) AS primary_image
     FROM packages p
     LEFT JOIN package_categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id]
  );

  if (packageRows.length === 0) {
    return null;
  }

  const [imageRows] = await conn.query(
    `SELECT id, image_url, is_primary
       FROM package_images
      WHERE package_id = ?
      ORDER BY is_primary DESC, id ASC`,
    [id]
  );

  const pkg = packageRows[0];

  return {
    id: pkg.id,
    name: pkg.name,
    category_id: pkg.category_id,
    category: pkg.category || "Uncategorized",
    description: pkg.description || "",
    image:
      pkg.primary_image ||
      (imageRows.length > 0 ? imageRows[0].image_url : null),
    price: parseFloat(pkg.price) || 0,
    guest_count: parseInt(pkg.guest_count, 10) || 1,
    read_time: parseInt(pkg.read_time, 10) || 1,
    status: pkg.status === 1,
    images: imageRows,
    created_at: pkg.created_at,
    updated_at: pkg.updated_at,
  };
};

// Validates the request body for create and update.
// Returns { error: { status, message } } or { values }.
const validatePackageFields = async (conn, body) => {
  const {
    name,
    category_id,
    description,
    price,
    guest_count,
    read_time,
    status,
  } = body;

  if (!name || !name.trim()) {
    return { error: { status: 400, message: "Package name is required" } };
  }

  if (!category_id) {
    return { error: { status: 400, message: "Category is required" } };
  }

  const [categoryCheck] = await conn.query(
    "SELECT id FROM package_categories WHERE id = ?",
    [category_id]
  );

  if (categoryCheck.length === 0) {
    return { error: { status: 404, message: "Category not found" } };
  }

  if (!price || isNaN(price) || parseFloat(price) < 0) {
    return { error: { status: 400, message: "Valid price is required" } };
  }

  const guestCount = parsePositiveInteger(guest_count);

  if (guestCount === null) {
    return {
      error: { status: 400, message: "Valid guest count is required" },
    };
  }

  const readTime = parsePositiveInteger(read_time);

  if (readTime === null) {
    return {
      error: { status: 400, message: "Valid read time is required" },
    };
  }

  return {
    values: {
      name: name.trim(),
      categoryId: parseInt(category_id, 10),
      description: description ? description.trim() : "",
      price: parseFloat(price),
      guestCount,
      readTime,
      status: parseStatus(status),
    },
  };
};

// =====================================================
// GET ALL PACKAGES WITH IMAGES
// =====================================================

exports.getAllPackages = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         ${PACKAGE_COLUMNS},
         GROUP_CONCAT(DISTINCT pi.image_url) AS images,
         (SELECT image_url
            FROM package_images
           WHERE package_id = p.id
             AND is_primary = 1
           LIMIT 1) AS primary_image
       FROM packages p
       LEFT JOIN package_categories c ON c.id = p.category_id
       LEFT JOIN package_images pi ON pi.package_id = p.id
       GROUP BY p.id, c.name
       ORDER BY p.id DESC`
    );

    const packages = rows.map((pkg) => {
      const imageList = pkg.images ? pkg.images.split(",") : [];

      return {
        id: pkg.id,
        name: pkg.name,
        category_id: pkg.category_id,
        category: pkg.category || "Uncategorized",
        description: pkg.description || "",
        image: pkg.primary_image || imageList[0] || null,
        images: imageList,
        price: parseFloat(pkg.price) || 0,
        guest_count: parseInt(pkg.guest_count, 10) || 1,
        read_time: parseInt(pkg.read_time, 10) || 1,
        status: pkg.status === 1,
        created_at: pkg.created_at,
        updated_at: pkg.updated_at,
      };
    });

    res.json({
      success: true,
      data: packages,
    });
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
// GET SINGLE PACKAGE WITH IMAGES
// =====================================================

exports.getPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const packageData = await buildPackageData(db, id);

    if (!packageData) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.json({
      success: true,
      data: packageData,
    });
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
// CREATE PACKAGE WITH IMAGES
// =====================================================

exports.createPackage = async (req, res) => {
  const connection = await db.getConnection();

  try {
    // -------------------------------------------------
    // VALIDATE
    // -------------------------------------------------

    const check = await validatePackageFields(connection, req.body);

    if (check.error) {
      return res.status(check.error.status).json({
        success: false,
        message: check.error.message,
      });
    }

    const v = check.values;

    // -------------------------------------------------
    // IMAGES
    // -------------------------------------------------

    const newImageUrls = (req.files || []).map(
      (file) => `/uploads/packages/${file.filename}`
    );

    const allImages = [
      ...parseJsonList(req.body.existingImages),
      ...newImageUrls,
    ];

    const mainImage = allImages.length > 0 ? allImages[0] : "";

    // -------------------------------------------------
    // INSERT (transaction)
    // -------------------------------------------------

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO packages
       (
         name,
         category_id,
         description,
         image,
         price,
         guest_count,
         read_time,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.name,
        v.categoryId,
        v.description,
        mainImage,
        v.price,
        v.guestCount,
        v.readTime,
        v.status ? 1 : 0,
      ]
    );

    const packageId = result.insertId;

    if (allImages.length > 0) {
      const imageValues = allImages.map((url, index) => [
        packageId,
        url,
        index === 0 ? 1 : 0,
      ]);

      await connection.query(
        `INSERT INTO package_images
         (
           package_id,
           image_url,
           is_primary
         )
         VALUES ?`,
        [imageValues]
      );
    }

    await connection.commit();

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    const packageData = await buildPackageData(connection, packageId);

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: packageData,
    });
  } catch (err) {
    await connection.rollback();

    console.error("Error creating package:", err);

    res.status(500).json({
      success: false,
      message: "Failed to create package",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// =====================================================
// UPDATE PACKAGE WITH IMAGES
// =====================================================

exports.updatePackage = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { id } = req.params;

    // -------------------------------------------------
    // CHECK PACKAGE EXISTS
    // -------------------------------------------------

    const [existing] = await connection.query(
      "SELECT id FROM packages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    // -------------------------------------------------
    // VALIDATE
    // -------------------------------------------------

    const check = await validatePackageFields(connection, req.body);

    if (check.error) {
      return res.status(check.error.status).json({
        success: false,
        message: check.error.message,
      });
    }

    const v = check.values;

    // -------------------------------------------------
    // IMAGE INPUT
    // -------------------------------------------------

    const newImageUrls = (req.files || []).map(
      (file) => `/uploads/packages/${file.filename}`
    );

    const existingImageList = parseJsonList(req.body.existingImages);
    const imagesToRemoveList = parseJsonList(req.body.imagesToRemove);

    await connection.beginTransaction();

    // -------------------------------------------------
    // FIND + DELETE REMOVED IMAGES
    // -------------------------------------------------

    const [currentImages] = await connection.query(
      `SELECT id, image_url
         FROM package_images
        WHERE package_id = ?`,
      [id]
    );

    const imagesToDelete = currentImages
      .map((img) => img.image_url)
      .filter(
        (url) =>
          imagesToRemoveList.includes(url) ||
          !existingImageList.includes(url)
      );

    for (const imageUrl of imagesToDelete) {
      await connection.query(
        `DELETE FROM package_images
          WHERE package_id = ?
            AND image_url = ?`,
        [id, imageUrl]
      );
    }

    // -------------------------------------------------
    // INSERT NEW IMAGES
    // -------------------------------------------------

    const allImages = [...existingImageList, ...newImageUrls];

    if (newImageUrls.length > 0) {
      const imageValues = newImageUrls.map((url) => [id, url, 0]);

      await connection.query(
        `INSERT INTO package_images
         (
           package_id,
           image_url,
           is_primary
         )
         VALUES ?`,
        [imageValues]
      );
    }

    // -------------------------------------------------
    // PRIMARY IMAGE
    // -------------------------------------------------

    if (allImages.length > 0) {
      await connection.query(
        `UPDATE package_images
            SET is_primary = 0
          WHERE package_id = ?`,
        [id]
      );

      await connection.query(
        `UPDATE package_images
            SET is_primary = 1
          WHERE package_id = ?
            AND image_url = ?`,
        [id, allImages[0]]
      );
    }

    const mainImage = allImages.length > 0 ? allImages[0] : "";

    // -------------------------------------------------
    // UPDATE PACKAGE
    // -------------------------------------------------

    await connection.query(
      `UPDATE packages
          SET name = ?,
              category_id = ?,
              description = ?,
              image = ?,
              price = ?,
              guest_count = ?,
              read_time = ?,
              status = ?
        WHERE id = ?`,
      [
        v.name,
        v.categoryId,
        v.description,
        mainImage,
        v.price,
        v.guestCount,
        v.readTime,
        v.status ? 1 : 0,
        id,
      ]
    );

    await connection.commit();

    // Remove files from disk only after the DB change is committed
    imagesToDelete.forEach(deleteFileIfExists);

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    const packageData = await buildPackageData(connection, id);

    res.json({
      success: true,
      message: "Package updated successfully",
      data: packageData,
    });
  } catch (err) {
    await connection.rollback();

    console.error("Error updating package:", err);

    res.status(500).json({
      success: false,
      message: "Failed to update package",
      error: err.message,
    });
  } finally {
    connection.release();
  }
};

// =====================================================
// TOGGLE STATUS
// =====================================================

exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      "SELECT id, status FROM packages WHERE id = ?",
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
      `UPDATE packages
          SET status = ?
        WHERE id = ?`,
      [newStatus, id]
    );

    res.json({
      success: true,
      message: "Package status updated successfully",
      data: {
        id: parseInt(id),
        status: newStatus === 1,
      },
    });
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
      `SELECT id, image
         FROM packages
        WHERE id = ?`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const [packageImages] = await db.query(
      `SELECT image_url
         FROM package_images
        WHERE package_id = ?`,
      [id]
    );

    // Delete main image + all additional images from disk
    deleteFileIfExists(existing[0].image);
    packageImages.forEach((img) => deleteFileIfExists(img.image_url));

    await db.query("DELETE FROM packages WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Package deleted successfully",
      data: {
        id: parseInt(id),
      },
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