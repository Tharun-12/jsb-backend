const db = require("../db");
const path = require("path");
const fs = require("fs");

// =====================================================
// HELPER: Parse status from form data
// =====================================================
const parseStatus = (status) => {
  if (status === undefined || status === null) return true;
  return (
    status === true ||
    status === 1 ||
    status === "1" ||
    status === "true"
  );
};

// =====================================================
// GET ALL PACKAGES WITH IMAGES
// =====================================================
exports.getAllPackages = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, 
        GROUP_CONCAT(DISTINCT pi.image_url) as images,
        (SELECT image_url FROM package_images WHERE package_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
       FROM packages p
       LEFT JOIN package_images pi ON p.id = pi.package_id
       GROUP BY p.id
       ORDER BY p.id DESC`
    );

    const packages = rows.map(pkg => ({
      ...pkg,
      images: pkg.images ? pkg.images.split(',') : [],
      image: pkg.primary_image || pkg.images?.split(',')[0] || null,
      price: parseFloat(pkg.price),
      status: pkg.status === 1
    }));

    res.json({ success: true, data: packages });
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

    const [packageRows] = await db.query(
      `SELECT p.*,
        (SELECT image_url FROM package_images WHERE package_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
       FROM packages p
       WHERE p.id = ?`,
      [id]
    );

    if (packageRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const [imageRows] = await db.query(
      `SELECT id, image_url, is_primary FROM package_images WHERE package_id = ? ORDER BY is_primary DESC, id ASC`,
      [id]
    );

    const packageData = {
      id: packageRows[0].id,
      name: packageRows[0].name,
      category: packageRows[0].category,
      description: packageRows[0].description || "",
      image: packageRows[0].primary_image || (imageRows.length > 0 ? imageRows[0].image_url : null),
      price: parseFloat(packageRows[0].price),
      status: packageRows[0].status === 1,
      images: imageRows,
      created_at: packageRows[0].created_at,
      updated_at: packageRows[0].updated_at
    };

    res.json({ success: true, data: packageData });
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
    await connection.beginTransaction();

    // Get form data - multer parses multipart/form-data into req.body
    const { name, category, description, price, status, existingImages } = req.body;

    // Debug log to see what we're receiving
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);

    // Validate required fields
    if (!name || !name.trim()) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Package name is required"
      });
    }

    if (!category) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    if (!price || isNaN(price) || parseFloat(price) < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid price is required"
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : "";
    const packageStatus = parseStatus(status);

    // Handle image uploads
    const uploadedFiles = req.files || [];
    let newImageUrls = uploadedFiles.map(file => `/uploads/packages/${file.filename}`);

    // Parse existing images from form data (if any)
    let existingImageList = [];
    if (existingImages) {
      try {
        existingImageList = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
      } catch (e) {
        existingImageList = [];
      }
    }

    // Combine existing and new images (existing first, then new)
    const allImages = [...existingImageList, ...newImageUrls];

    // Set main image (first image or empty)
    const mainImage = allImages.length > 0 ? allImages[0] : "";

    // Insert package
    const [result] = await connection.query(
      `INSERT INTO packages (name, category, description, image, price, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trimmedName, category, trimmedDescription, mainImage, parseFloat(price), packageStatus ? 1 : 0]
    );

    const packageId = result.insertId;

    // Insert package images
    if (allImages.length > 0) {
      const imageValues = allImages.map((url, index) => [
        packageId,
        url,
        index === 0 ? 1 : 0 // First image is primary
      ]);

      await connection.query(
        "INSERT INTO package_images (package_id, image_url, is_primary) VALUES ?",
        [imageValues]
      );
    }

    await connection.commit();

    // Fetch created package with images
    const [packageRows] = await connection.query(
      `SELECT p.*,
        (SELECT image_url FROM package_images WHERE package_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
       FROM packages p
       WHERE p.id = ?`,
      [packageId]
    );

    const [imageRows] = await connection.query(
      `SELECT id, image_url, is_primary FROM package_images WHERE package_id = ? ORDER BY is_primary DESC, id ASC`,
      [packageId]
    );

    const packageData = {
      id: packageRows[0].id,
      name: packageRows[0].name,
      category: packageRows[0].category,
      description: packageRows[0].description || "",
      image: packageRows[0].primary_image || (imageRows.length > 0 ? imageRows[0].image_url : null),
      price: parseFloat(packageRows[0].price),
      status: packageRows[0].status === 1,
      images: imageRows,
      created_at: packageRows[0].created_at,
      updated_at: packageRows[0].updated_at
    };

    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: packageData
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
    await connection.beginTransaction();

    const { id } = req.params;
    const { name, category, description, price, status, existingImages, imagesToRemove } = req.body;

    // Debug log
    console.log("Update - Request body:", req.body);
    console.log("Update - Request files:", req.files);

    // Check if package exists
    const [existing] = await connection.query(
      "SELECT id, image FROM packages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Package not found"
      });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Package name is required"
      });
    }

    if (!category) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    if (!price || isNaN(price) || parseFloat(price) < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Valid price is required"
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : "";
    const packageStatus = parseStatus(status);

    // Handle new image uploads
    const uploadedFiles = req.files || [];
    let newImageUrls = uploadedFiles.map(file => `/uploads/packages/${file.filename}`);

    // Parse existing images from form data
    let existingImageList = [];
    if (existingImages) {
      try {
        existingImageList = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
      } catch (e) {
        existingImageList = [];
      }
    }

    // Parse images to remove
    let imagesToRemoveList = [];
    if (imagesToRemove) {
      try {
        imagesToRemoveList = typeof imagesToRemove === 'string' ? JSON.parse(imagesToRemove) : imagesToRemove;
      } catch (e) {
        imagesToRemoveList = [];
      }
    }

    // Get current images from database
    const [currentImages] = await connection.query(
      "SELECT id, image_url FROM package_images WHERE package_id = ?",
      [id]
    );

    // Delete images that are marked for removal or not in existing list
    const currentImageUrls = currentImages.map(img => img.image_url);

    // Images to delete = images marked for removal + images not in existing list
    const imagesToDelete = currentImageUrls.filter(url =>
      imagesToRemoveList.includes(url) || !existingImageList.includes(url)
    );

    for (const imageUrl of imagesToDelete) {
      // Delete from database
      await connection.query(
        "DELETE FROM package_images WHERE package_id = ? AND image_url = ?",
        [id, imageUrl]
      );

      // Delete file from disk
      const imagePath = path.join(__dirname, "../", imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Combine existing and new images (existing already ordered with primary first)
    const allImages = [...existingImageList, ...newImageUrls];

    // Insert new images
    if (newImageUrls.length > 0) {
      const imageValues = newImageUrls.map((url) => [
        id,
        url,
        0 // Will update primary flag later
      ]);

      await connection.query(
        "INSERT INTO package_images (package_id, image_url, is_primary) VALUES ?",
        [imageValues]
      );
    }

    // Update primary image flag - set first image as primary
    if (allImages.length > 0) {
      // Reset all primary flags
      await connection.query(
        "UPDATE package_images SET is_primary = 0 WHERE package_id = ?",
        [id]
      );

      // Set first image as primary
      await connection.query(
        "UPDATE package_images SET is_primary = 1 WHERE package_id = ? AND image_url = ?",
        [id, allImages[0]]
      );
    }

    // Set main image (first image or empty)
    const mainImage = allImages.length > 0 ? allImages[0] : "";

    // Update package
    await connection.query(
      `UPDATE packages 
       SET name = ?, category = ?, description = ?, image = ?, price = ?, status = ?
       WHERE id = ?`,
      [trimmedName, category, trimmedDescription, mainImage, parseFloat(price), packageStatus ? 1 : 0, id]
    );

    await connection.commit();

    // Fetch updated package with images
    const [packageRows] = await connection.query(
      `SELECT p.*,
        (SELECT image_url FROM package_images WHERE package_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
       FROM packages p
       WHERE p.id = ?`,
      [id]
    );

    const [imageRows] = await connection.query(
      `SELECT id, image_url, is_primary FROM package_images WHERE package_id = ? ORDER BY is_primary DESC, id ASC`,
      [id]
    );

    const packageData = {
      id: packageRows[0].id,
      name: packageRows[0].name,
      category: packageRows[0].category,
      description: packageRows[0].description || "",
      image: packageRows[0].primary_image || (imageRows.length > 0 ? imageRows[0].image_url : null),
      price: parseFloat(packageRows[0].price),
      status: packageRows[0].status === 1,
      images: imageRows,
      created_at: packageRows[0].created_at,
      updated_at: packageRows[0].updated_at
    };

    res.json({
      success: true,
      message: "Package updated successfully",
      data: packageData
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

    res.json({
      success: true,
      message: "Package status updated successfully",
      data: {
        id: parseInt(id),
        status: newStatus === 1
      }
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

    // Check if package exists and get image paths
    const [existing] = await db.query(
      "SELECT id, image FROM packages WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    // Get all package images
    const [packageImages] = await db.query(
      "SELECT image_url FROM package_images WHERE package_id = ?",
      [id]
    );

    // Delete package image files
    if (existing[0].image) {
      const imagePath = path.join(__dirname, "../", existing[0].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete additional images
    for (const img of packageImages) {
      const imagePath = path.join(__dirname, "../", img.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete package (cascade will delete related images from database)
    await db.query("DELETE FROM packages WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Package deleted successfully",
      data: {
        id: parseInt(id)
      }
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