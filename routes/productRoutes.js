const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =====================================================
// FILE UPLOAD CONFIGURATION
// =====================================================

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "../uploads/products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, "product-" + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// =====================================================
// HELPER: Normalize "status" coming from multipart/form-data.
// FormData always sends values as strings, so status will
// arrive as "1" / "0" / "true" / "false" (string), not a
// boolean or number. The previous code never checked for the
// string "1", so it always fell through and saved status = 0.
// =====================================================
const parseStatus = (status) => {
  if (status === undefined || status === null) return true; // default to active
  return (
    status === true ||
    status === 1 ||
    status === "1" ||
    status === "true"
  );
};

// =====================================================
// GET ALL PRODUCTS
// =====================================================
router.get("/products", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        p.id, 
        p.name, 
        p.category_id,
        c.name as category,
        p.description, 
        p.image, 
        p.price, 
        p.status,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      ORDER BY p.id DESC`
    );

    // Get images for each product
    const products = [];
    for (const product of rows) {
      // Get additional images
      const [images] = await db.query(
        "SELECT id, image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC",
        [product.id]
      );

      const imageUrls = images.map(img => img.image_url);

      // Set primary image if available, otherwise use the main image
      const mainImage = product.image || (imageUrls.length > 0 ? imageUrls[0] : "");

      products.push({
        id: product.id,
        name: product.name,
        category_id: product.category_id,
        category: product.category || "Uncategorized",
        description: product.description || "",
        image: mainImage,
        images: imageUrls,
        price: parseFloat(product.price),
        status: product.status === 1,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      });
    }

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message
    });
  }
});

// =====================================================
// GET SINGLE PRODUCT BY ID
// =====================================================
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `SELECT 
        p.id, 
        p.name, 
        p.category_id,
        c.name as category,
        p.description, 
        p.image, 
        p.price, 
        p.status,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Get additional images
    const [images] = await db.query(
      "SELECT id, image_url, is_primary FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC",
      [id]
    );

    const imageUrls = images.map(img => img.image_url);
    const mainImage = rows[0].image || (imageUrls.length > 0 ? imageUrls[0] : "");

    const product = {
      id: rows[0].id,
      name: rows[0].name,
      category_id: rows[0].category_id,
      category: rows[0].category || "Uncategorized",
      description: rows[0].description || "",
      image: mainImage,
      images: imageUrls,
      price: parseFloat(rows[0].price),
      status: rows[0].status === 1,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at
    };

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message
    });
  }
});

// =====================================================
// CREATE PRODUCT (with multiple image upload)
// =====================================================
router.post("/products", upload.array("images", 5), async (req, res) => {
  try {
    const { name, category_id, description, price, status } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required"
      });
    }

    if (!price || isNaN(price) || parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required"
      });
    }

    // Check if category exists
    const [categoryCheck] = await db.query(
      "SELECT id FROM product_categories WHERE id = ?",
      [category_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : "";
    const productStatus = parseStatus(status);

    // Handle image uploads
    const uploadedFiles = req.files || [];
    let imageUrls = [];

    if (uploadedFiles.length > 0) {
      imageUrls = uploadedFiles.map(file => `/uploads/products/${file.filename}`);
    }

    // Set main image (first uploaded image or empty)
    const mainImage = imageUrls.length > 0 ? imageUrls[0] : "";

    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Insert product
      const [result] = await connection.query(
        `INSERT INTO products 
         (name, category_id, description, image, price, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [trimmedName, category_id, trimmedDescription, mainImage, parseFloat(price), productStatus ? 1 : 0]
      );

      const productId = result.insertId;

      // Insert product images
      if (imageUrls.length > 0) {
        const imageValues = imageUrls.map((url, index) => [
          productId,
          url,
          index === 0 ? 1 : 0 // First image is primary
        ]);

        await connection.query(
          "INSERT INTO product_images (product_id, image_url, is_primary) VALUES ?",
          [imageValues]
        );
      }

      await connection.commit();

      // Fetch the newly created product with images
      const [newProduct] = await connection.query(
        `SELECT 
          p.id, 
          p.name, 
          p.category_id,
          c.name as category,
          p.description, 
          p.image, 
          p.price, 
          p.status,
          p.created_at,
          p.updated_at
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE p.id = ?`,
        [productId]
      );

      const [productImages] = await connection.query(
        "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC",
        [productId]
      );

      const allImages = productImages.map(img => img.image_url);

      const product = {
        id: newProduct[0].id,
        name: newProduct[0].name,
        category_id: newProduct[0].category_id,
        category: newProduct[0].category || "Uncategorized",
        description: newProduct[0].description || "",
        image: newProduct[0].image || (allImages.length > 0 ? allImages[0] : ""),
        images: allImages,
        price: parseFloat(newProduct[0].price),
        status: newProduct[0].status === 1,
        createdAt: newProduct[0].created_at,
        updatedAt: newProduct[0].updated_at
      };

      res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message
    });
  }
});

// =====================================================
// UPDATE PRODUCT (with multiple image upload)
// =====================================================
router.put("/products/:id", upload.array("images", 5), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, description, price, status, existingImages, imagesToRemove } = req.body;

    // Check if product exists
    const [existing] = await db.query(
      "SELECT id, image FROM products WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Product name is required"
      });
    }

    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required"
      });
    }

    if (!price || isNaN(price) || parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid price is required"
      });
    }

    // Check if category exists
    const [categoryCheck] = await db.query(
      "SELECT id FROM product_categories WHERE id = ?",
      [category_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const trimmedName = name.trim();
    const trimmedDescription = description ? description.trim() : "";
    const productStatus = parseStatus(status);

    // Get connection for transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // Handle new image uploads
      const uploadedFiles = req.files || [];
      let newImageUrls = uploadedFiles.map(file => `/uploads/products/${file.filename}`);

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
        "SELECT id, image_url FROM product_images WHERE product_id = ?",
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
          "DELETE FROM product_images WHERE product_id = ? AND image_url = ?",
          [id, imageUrl]
        );

        // Delete file from disk
        const imagePath = path.join(__dirname, "../", imageUrl);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      // Combine existing and new images (existingImageList already
      // arrives ordered with the chosen main image first, from the frontend)
      const allImages = [...existingImageList, ...newImageUrls];

      // Insert new images
      if (newImageUrls.length > 0) {
        const imageValues = newImageUrls.map((url) => [
          id,
          url,
          0 // Will update primary flag later
        ]);

        await connection.query(
          "INSERT INTO product_images (product_id, image_url, is_primary) VALUES ?",
          [imageValues]
        );
      }

      // Update primary image flag - set first image as primary
      if (allImages.length > 0) {
        // Reset all primary flags
        await connection.query(
          "UPDATE product_images SET is_primary = 0 WHERE product_id = ?",
          [id]
        );

        // Set first image as primary
        await connection.query(
          "UPDATE product_images SET is_primary = 1 WHERE product_id = ? AND image_url = ?",
          [id, allImages[0]]
        );
      }

      // Set main image (first image or empty)
      const mainImage = allImages.length > 0 ? allImages[0] : "";

      // Update product
      await connection.query(
        `UPDATE products 
         SET name = ?, category_id = ?, description = ?, image = ?, price = ?, status = ?
         WHERE id = ?`,
        [trimmedName, category_id, trimmedDescription, mainImage, parseFloat(price), productStatus ? 1 : 0, id]
      );

      await connection.commit();

      // Fetch updated product
      const [updatedProduct] = await connection.query(
        `SELECT 
          p.id, 
          p.name, 
          p.category_id,
          c.name as category,
          p.description, 
          p.image, 
          p.price, 
          p.status,
          p.created_at,
          p.updated_at
        FROM products p
        LEFT JOIN product_categories c ON p.category_id = c.id
        WHERE p.id = ?`,
        [id]
      );

      const [productImages] = await connection.query(
        "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC",
        [id]
      );

      const allImagesUrls = productImages.map(img => img.image_url);

      const product = {
        id: updatedProduct[0].id,
        name: updatedProduct[0].name,
        category_id: updatedProduct[0].category_id,
        category: updatedProduct[0].category || "Uncategorized",
        description: updatedProduct[0].description || "",
        image: updatedProduct[0].image || (allImagesUrls.length > 0 ? allImagesUrls[0] : ""),
        images: allImagesUrls,
        price: parseFloat(updatedProduct[0].price),
        status: updatedProduct[0].status === 1,
        createdAt: updatedProduct[0].created_at,
        updatedAt: updatedProduct[0].updated_at
      };

      res.json({
        success: true,
        message: "Product updated successfully",
        data: product
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message
    });
  }
});

// =====================================================
// DELETE PRODUCT
// =====================================================
router.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists and get image paths
    const [existing] = await db.query(
      "SELECT id, image FROM products WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Get all product images
    const [productImages] = await db.query(
      "SELECT image_url FROM product_images WHERE product_id = ?",
      [id]
    );

    // Delete product image files
    if (existing[0].image) {
      const imagePath = path.join(__dirname, "../", existing[0].image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete additional images
    for (const img of productImages) {
      const imagePath = path.join(__dirname, "../", img.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete product (cascade will delete related images from database)
    await db.query("DELETE FROM products WHERE id = ?", [id]);

    res.json({
      success: true,
      message: "Product deleted successfully",
      data: {
        id: parseInt(id)
      }
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message
    });
  }
});

// =====================================================
// GET PRODUCTS BY CATEGORY
// =====================================================
router.get("/products/category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;

    const [rows] = await db.query(
      `SELECT 
        p.id, 
        p.name, 
        p.category_id,
        c.name as category,
        p.description, 
        p.image, 
        p.price, 
        p.status,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.category_id = ?
      ORDER BY p.id DESC`,
      [categoryId]
    );

    const products = [];
    for (const product of rows) {
      const [images] = await db.query(
        "SELECT image_url FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, id ASC",
        [product.id]
      );
      const imageUrls = images.map(img => img.image_url);

      products.push({
        id: product.id,
        name: product.name,
        category_id: product.category_id,
        category: product.category || "Uncategorized",
        description: product.description || "",
        image: product.image || (imageUrls.length > 0 ? imageUrls[0] : ""),
        images: imageUrls,
        price: parseFloat(product.price),
        status: product.status === 1,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      });
    }

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error("Error fetching products by category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message
    });
  }
});

// =====================================================
// TOGGLE PRODUCT STATUS
// =====================================================
router.patch("/products/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status === undefined) {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const [existing] = await db.query(
      "SELECT id FROM products WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    const newStatus = parseStatus(status);

    await db.query(
      "UPDATE products SET status = ? WHERE id = ?",
      [newStatus ? 1 : 0, id]
    );

    res.json({
      success: true,
      message: "Product status updated successfully",
      data: {
        id: parseInt(id),
        status: newStatus
      }
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update product status",
      error: error.message
    });
  }
});

module.exports = router;