const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =====================================================
// FILE UPLOAD CONFIGURATION
// =====================================================

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
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1E9);

    const ext = path.extname(file.originalname);

    cb(null, "product-" + uniqueSuffix + ext);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;

  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );

  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        "Only image files are allowed (jpeg, jpg, png, gif, webp)"
      )
    );
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: fileFilter
});

// =====================================================
// HELPER: NORMALIZE STATUS
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

// =====================================================
// HELPER: VALIDATE PRODUCT PRICING
// =====================================================

const validateProductPricing = (
  price,
  min_order_quantity,
  discount
) => {

  // Validate price
  if (
    price === undefined ||
    price === null ||
    price === "" ||
    isNaN(price) ||
    parseFloat(price) < 0
  ) {
    return "Valid price is required";
  }

  // Validate minimum order quantity
  if (
    min_order_quantity === undefined ||
    min_order_quantity === null ||
    min_order_quantity === "" ||
    isNaN(min_order_quantity) ||
    parseInt(min_order_quantity) < 1
  ) {
    return "Minimum order quantity must be at least 1";
  }

  // Validate discount percentage
  if (
    discount === undefined ||
    discount === null ||
    discount === "" ||
    isNaN(discount) ||
    parseFloat(discount) < 0 ||
    parseFloat(discount) > 100
  ) {
    return "Discount must be between 0% and 100%";
  }

  return null;
};

// =====================================================
// HELPER: CALCULATE SELLING PRICE
// =====================================================

const calculateSellingPrice = (
  price,
  discount
) => {

  const productPrice =
    parseFloat(price) || 0;

  const discountPercentage =
    parseFloat(discount) || 0;

  const discountAmount =
    productPrice *
    (discountPercentage / 100);

  const sellingPrice =
    productPrice - discountAmount;

  return Math.max(
    Number(sellingPrice.toFixed(2)),
    0
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
        c.name AS category,
        p.description,
        p.image,
        p.price,
        p.min_order_quantity,
        p.discount,
        p.status,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN product_categories c
        ON p.category_id = c.id
      ORDER BY p.id DESC`
    );

    const products = [];

    for (const product of rows) {

      const [images] = await db.query(
        `SELECT
          id,
          image_url,
          is_primary
         FROM product_images
         WHERE product_id = ?
         ORDER BY is_primary DESC, id ASC`,
        [product.id]
      );

      const imageUrls =
        images.map(
          (img) => img.image_url
        );

      const mainImage =
        product.image ||
        (imageUrls.length > 0
          ? imageUrls[0]
          : "");

      const price =
        parseFloat(product.price) || 0;

      const discount =
        parseFloat(product.discount) || 0;

      products.push({

        id: product.id,

        name: product.name,

        category_id:
          product.category_id,

        category:
          product.category ||
          "Uncategorized",

        description:
          product.description || "",

        image: mainImage,

        images: imageUrls,

        price: price,

        min_order_quantity:
          parseInt(
            product.min_order_quantity
          ) || 1,

        discount: discount,

        status:
          product.status === 1,

        createdAt:
          product.created_at,

        updatedAt:
          product.updated_at
      });
    }

    res.json({
      success: true,
      data: products
    });

  } catch (error) {

    console.error(
      "Error fetching products:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch products",
      error: error.message
    });
  }
});

// =====================================================
// GET SINGLE PRODUCT BY ID
// =====================================================

router.get(
  "/products/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const [rows] =
        await db.query(
          `SELECT
            p.id,
            p.name,
            p.category_id,
            c.name AS category,
            p.description,
            p.image,
            p.price,
            p.min_order_quantity,
            p.discount,
            p.status,
            p.created_at,
            p.updated_at
          FROM products p
          LEFT JOIN product_categories c
            ON p.category_id = c.id
          WHERE p.id = ?`,
          [id]
        );

      if (rows.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Product not found"
        });
      }

      const [images] =
        await db.query(
          `SELECT
            id,
            image_url,
            is_primary
           FROM product_images
           WHERE product_id = ?
           ORDER BY is_primary DESC, id ASC`,
          [id]
        );

      const imageUrls =
        images.map(
          (img) => img.image_url
        );

      const mainImage =
        rows[0].image ||
        (imageUrls.length > 0
          ? imageUrls[0]
          : "");

      const product = {

        id: rows[0].id,

        name: rows[0].name,

        category_id:
          rows[0].category_id,

        category:
          rows[0].category ||
          "Uncategorized",

        description:
          rows[0].description || "",

        image: mainImage,

        images: imageUrls,

        price:
          parseFloat(
            rows[0].price
          ) || 0,

        min_order_quantity:
          parseInt(
            rows[0].min_order_quantity
          ) || 1,

        discount:
          parseFloat(
            rows[0].discount
          ) || 0,

        status:
          rows[0].status === 1,

        createdAt:
          rows[0].created_at,

        updatedAt:
          rows[0].updated_at
      };

      res.json({
        success: true,
        data: product
      });

    } catch (error) {

      console.error(
        "Error fetching product:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to fetch product",
        error: error.message
      });
    }
  }
);

// =====================================================
// CREATE PRODUCT
// =====================================================

router.post(
  "/products",
  upload.array("images", 5),
  async (req, res) => {

    try {

      const {
        name,
        category_id,
        description,
        price,
        min_order_quantity,
        discount,
        status
      } = req.body;

      // -------------------------------------------------
      // VALIDATE PRODUCT NAME
      // -------------------------------------------------

      if (!name || !name.trim()) {

        return res.status(400).json({
          success: false,
          message:
            "Product name is required"
        });
      }

      // -------------------------------------------------
      // VALIDATE CATEGORY
      // -------------------------------------------------

      if (!category_id) {

        return res.status(400).json({
          success: false,
          message:
            "Category ID is required"
        });
      }

      // -------------------------------------------------
      // VALIDATE PRICING
      // -------------------------------------------------

      const pricingError =
        validateProductPricing(
          price,
          min_order_quantity,
          discount
        );

      if (pricingError) {

        return res.status(400).json({
          success: false,
          message: pricingError
        });
      }

      // -------------------------------------------------
      // CHECK CATEGORY
      // -------------------------------------------------

      const [categoryCheck] =
        await db.query(
          "SELECT id FROM product_categories WHERE id = ?",
          [category_id]
        );

      if (categoryCheck.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Category not found"
        });
      }

      // -------------------------------------------------
      // PREPARE DATA
      // -------------------------------------------------

      const trimmedName =
        name.trim();

      const trimmedDescription =
        description
          ? description.trim()
          : "";

      const productStatus =
        parseStatus(status);

      const productPrice =
        parseFloat(price);

      const productMinOrderQuantity =
        parseInt(min_order_quantity);

      // Discount is percentage
      const productDiscount =
        parseFloat(discount);

      // -------------------------------------------------
      // HANDLE IMAGE UPLOADS
      // -------------------------------------------------

      const uploadedFiles =
        req.files || [];

      let imageUrls = [];

      if (uploadedFiles.length > 0) {

        imageUrls =
          uploadedFiles.map(
            (file) =>
              `/uploads/products/${file.filename}`
          );
      }

      const mainImage =
        imageUrls.length > 0
          ? imageUrls[0]
          : "";

      // -------------------------------------------------
      // START TRANSACTION
      // -------------------------------------------------

      const connection =
        await db.getConnection();

      await connection.beginTransaction();

      try {

        // -------------------------------------------------
        // INSERT PRODUCT
        // -------------------------------------------------

        const [result] =
          await connection.query(
            `INSERT INTO products
            (
              name,
              category_id,
              description,
              image,
              price,
              min_order_quantity,
              discount,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              trimmedName,
              category_id,
              trimmedDescription,
              mainImage,
              productPrice,
              productMinOrderQuantity,
              productDiscount,
              productStatus ? 1 : 0
            ]
          );

        const productId =
          result.insertId;

        // -------------------------------------------------
        // INSERT PRODUCT IMAGES
        // -------------------------------------------------

        if (imageUrls.length > 0) {

          const imageValues =
            imageUrls.map(
              (url, index) => [
                productId,
                url,
                index === 0
                  ? 1
                  : 0
              ]
            );

          await connection.query(
            `INSERT INTO product_images
            (
              product_id,
              image_url,
              is_primary
            )
            VALUES ?`,
            [imageValues]
          );
        }

        await connection.commit();

        // -------------------------------------------------
        // FETCH CREATED PRODUCT
        // -------------------------------------------------

        const [newProduct] =
          await connection.query(
            `SELECT
              p.id,
              p.name,
              p.category_id,
              c.name AS category,
              p.description,
              p.image,
              p.price,
              p.min_order_quantity,
              p.discount,
              p.status,
              p.created_at,
              p.updated_at
            FROM products p
            LEFT JOIN product_categories c
              ON p.category_id = c.id
            WHERE p.id = ?`,
            [productId]
          );

        const [productImages] =
          await connection.query(
            `SELECT image_url
             FROM product_images
             WHERE product_id = ?
             ORDER BY is_primary DESC, id ASC`,
            [productId]
          );

        const allImages =
          productImages.map(
            (img) =>
              img.image_url
          );

        const product = {

          id:
            newProduct[0].id,

          name:
            newProduct[0].name,

          category_id:
            newProduct[0].category_id,

          category:
            newProduct[0].category ||
            "Uncategorized",

          description:
            newProduct[0].description ||
            "",

          image:
            newProduct[0].image ||
            (allImages.length > 0
              ? allImages[0]
              : ""),

          images:
            allImages,

          price:
            parseFloat(
              newProduct[0].price
            ) || 0,

          min_order_quantity:
            parseInt(
              newProduct[0]
                .min_order_quantity
            ) || 1,

          discount:
            parseFloat(
              newProduct[0].discount
            ) || 0,

          status:
            newProduct[0].status === 1,

          createdAt:
            newProduct[0].created_at,

          updatedAt:
            newProduct[0].updated_at
        };

        res.status(201).json({
          success: true,
          message:
            "Product created successfully",
          data: product
        });

      } catch (error) {

        await connection.rollback();

        throw error;

      } finally {

        connection.release();

      }

    } catch (error) {

      console.error(
        "Error creating product:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to create product",
        error: error.message
      });
    }
  }
);

// =====================================================
// UPDATE PRODUCT
// =====================================================

router.put(
  "/products/:id",
  upload.array("images", 5),
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const {
        name,
        category_id,
        description,
        price,
        min_order_quantity,
        discount,
        status,
        existingImages,
        imagesToRemove
      } = req.body;

      // -------------------------------------------------
      // CHECK PRODUCT EXISTS
      // -------------------------------------------------

      const [existing] =
        await db.query(
          "SELECT id, image FROM products WHERE id = ?",
          [id]
        );

      if (existing.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Product not found"
        });
      }

      // -------------------------------------------------
      // VALIDATE NAME
      // -------------------------------------------------

      if (!name || !name.trim()) {

        return res.status(400).json({
          success: false,
          message:
            "Product name is required"
        });
      }

      // -------------------------------------------------
      // VALIDATE CATEGORY
      // -------------------------------------------------

      if (!category_id) {

        return res.status(400).json({
          success: false,
          message:
            "Category ID is required"
        });
      }

      // -------------------------------------------------
      // VALIDATE PRICING
      // -------------------------------------------------

      const pricingError =
        validateProductPricing(
          price,
          min_order_quantity,
          discount
        );

      if (pricingError) {

        return res.status(400).json({
          success: false,
          message: pricingError
        });
      }

      // -------------------------------------------------
      // CHECK CATEGORY
      // -------------------------------------------------

      const [categoryCheck] =
        await db.query(
          "SELECT id FROM product_categories WHERE id = ?",
          [category_id]
        );

      if (categoryCheck.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Category not found"
        });
      }

      // -------------------------------------------------
      // PREPARE DATA
      // -------------------------------------------------

      const trimmedName =
        name.trim();

      const trimmedDescription =
        description
          ? description.trim()
          : "";

      const productStatus =
        parseStatus(status);

      const productPrice =
        parseFloat(price);

      const productMinOrderQuantity =
        parseInt(
          min_order_quantity
        );

      const productDiscount =
        parseFloat(discount);

      // -------------------------------------------------
      // START TRANSACTION
      // -------------------------------------------------

      const connection =
        await db.getConnection();

      await connection.beginTransaction();

      try {

        // -------------------------------------------------
        // HANDLE NEW IMAGES
        // -------------------------------------------------

        const uploadedFiles =
          req.files || [];

        const newImageUrls =
          uploadedFiles.map(
            (file) =>
              `/uploads/products/${file.filename}`
          );

        // -------------------------------------------------
        // PARSE EXISTING IMAGES
        // -------------------------------------------------

        let existingImageList = [];

        if (existingImages) {

          try {

            existingImageList =
              typeof existingImages === "string"
                ? JSON.parse(existingImages)
                : existingImages;

          } catch (e) {

            existingImageList = [];
          }
        }

        // -------------------------------------------------
        // PARSE IMAGES TO REMOVE
        // -------------------------------------------------

        let imagesToRemoveList = [];

        if (imagesToRemove) {

          try {

            imagesToRemoveList =
              typeof imagesToRemove === "string"
                ? JSON.parse(imagesToRemove)
                : imagesToRemove;

          } catch (e) {

            imagesToRemoveList = [];
          }
        }

        // -------------------------------------------------
        // GET CURRENT IMAGES
        // -------------------------------------------------

        const [currentImages] =
          await connection.query(
            `SELECT
              id,
              image_url
             FROM product_images
             WHERE product_id = ?`,
            [id]
          );

        const currentImageUrls =
          currentImages.map(
            (img) =>
              img.image_url
          );

        // -------------------------------------------------
        // FIND IMAGES TO DELETE
        // -------------------------------------------------

        const imagesToDelete =
          currentImageUrls.filter(
            (url) =>
              imagesToRemoveList.includes(url) ||
              !existingImageList.includes(url)
          );

        // -------------------------------------------------
        // DELETE IMAGES
        // -------------------------------------------------

        for (
          const imageUrl
          of imagesToDelete
        ) {

          await connection.query(
            `DELETE FROM product_images
             WHERE product_id = ?
             AND image_url = ?`,
            [id, imageUrl]
          );

          const imagePath =
            path.join(
              __dirname,
              "../",
              imageUrl
            );

          if (
            fs.existsSync(
              imagePath
            )
          ) {
            fs.unlinkSync(
              imagePath
            );
          }
        }

        // -------------------------------------------------
        // COMBINE IMAGES
        // -------------------------------------------------

        const allImages = [
          ...existingImageList,
          ...newImageUrls
        ];

        // -------------------------------------------------
        // INSERT NEW IMAGES
        // -------------------------------------------------

        if (
          newImageUrls.length > 0
        ) {

          const imageValues =
            newImageUrls.map(
              (url) => [
                id,
                url,
                0
              ]
            );

          await connection.query(
            `INSERT INTO product_images
            (
              product_id,
              image_url,
              is_primary
            )
            VALUES ?`,
            [imageValues]
          );
        }

        // -------------------------------------------------
        // UPDATE PRIMARY IMAGE
        // -------------------------------------------------

        if (
          allImages.length > 0
        ) {

          await connection.query(
            `UPDATE product_images
             SET is_primary = 0
             WHERE product_id = ?`,
            [id]
          );

          await connection.query(
            `UPDATE product_images
             SET is_primary = 1
             WHERE product_id = ?
             AND image_url = ?`,
            [
              id,
              allImages[0]
            ]
          );
        }

        // -------------------------------------------------
        // SET MAIN IMAGE
        // -------------------------------------------------

        const mainImage =
          allImages.length > 0
            ? allImages[0]
            : "";

        // -------------------------------------------------
        // UPDATE PRODUCT
        // -------------------------------------------------

        await connection.query(
          `UPDATE products
           SET
             name = ?,
             category_id = ?,
             description = ?,
             image = ?,
             price = ?,
             min_order_quantity = ?,
             discount = ?,
             status = ?
           WHERE id = ?`,
          [
            trimmedName,
            category_id,
            trimmedDescription,
            mainImage,
            productPrice,
            productMinOrderQuantity,
            productDiscount,
            productStatus
              ? 1
              : 0,
            id
          ]
        );

        await connection.commit();

        // -------------------------------------------------
        // FETCH UPDATED PRODUCT
        // -------------------------------------------------

        const [updatedProduct] =
          await connection.query(
            `SELECT
              p.id,
              p.name,
              p.category_id,
              c.name AS category,
              p.description,
              p.image,
              p.price,
              p.min_order_quantity,
              p.discount,
              p.status,
              p.created_at,
              p.updated_at
            FROM products p
            LEFT JOIN product_categories c
              ON p.category_id = c.id
            WHERE p.id = ?`,
            [id]
          );

        const [productImages] =
          await connection.query(
            `SELECT image_url
             FROM product_images
             WHERE product_id = ?
             ORDER BY is_primary DESC, id ASC`,
            [id]
          );

        const allImagesUrls =
          productImages.map(
            (img) =>
              img.image_url
          );

        const product = {

          id:
            updatedProduct[0].id,

          name:
            updatedProduct[0].name,

          category_id:
            updatedProduct[0].category_id,

          category:
            updatedProduct[0].category ||
            "Uncategorized",

          description:
            updatedProduct[0].description ||
            "",

          image:
            updatedProduct[0].image ||
            (allImagesUrls.length > 0
              ? allImagesUrls[0]
              : ""),

          images:
            allImagesUrls,

          price:
            parseFloat(
              updatedProduct[0].price
            ) || 0,

          min_order_quantity:
            parseInt(
              updatedProduct[0]
                .min_order_quantity
            ) || 1,

          discount:
            parseFloat(
              updatedProduct[0].discount
            ) || 0,

          status:
            updatedProduct[0].status === 1,

          createdAt:
            updatedProduct[0].created_at,

          updatedAt:
            updatedProduct[0].updated_at
        };

        res.json({
          success: true,
          message:
            "Product updated successfully",
          data: product
        });

      } catch (error) {

        await connection.rollback();

        throw error;

      } finally {

        connection.release();

      }

    } catch (error) {

      console.error(
        "Error updating product:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update product",
        error: error.message
      });
    }
  }
);

// =====================================================
// GET SELLING PRICE
// =====================================================
//
// Selling Price = Price - (Price * Discount / 100)
//
// Example:
// Price = 1000
// Discount = 30%
// Selling Price = 1000 - (1000 * 30 / 100)
//              = 700
// =====================================================

router.get(
  "/products/:id/selling-price",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const [rows] =
        await db.query(
          `SELECT
            id,
            name,
            price,
            discount
           FROM products
           WHERE id = ?`,
          [id]
        );

      if (rows.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Product not found"
        });
      }

      const price =
        parseFloat(
          rows[0].price
        ) || 0;

      const discount =
        parseFloat(
          rows[0].discount
        ) || 0;

      const sellingPrice =
        calculateSellingPrice(
          price,
          discount
        );

      res.json({

        success: true,

        data: {

          product_id:
            rows[0].id,

          product_name:
            rows[0].name,

          price:
            price,

          discount:
            discount,

          selling_price:
            sellingPrice
        }
      });

    } catch (error) {

      console.error(
        "Error calculating selling price:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to calculate selling price",
        error: error.message
      });
    }
  }
);

// =====================================================
// DELETE PRODUCT
// =====================================================

router.delete(
  "/products/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const [existing] =
        await db.query(
          "SELECT id, image FROM products WHERE id = ?",
          [id]
        );

      if (existing.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Product not found"
        });
      }

      const [productImages] =
        await db.query(
          `SELECT image_url
           FROM product_images
           WHERE product_id = ?`,
          [id]
        );

      // Delete main image
      if (existing[0].image) {

        const imagePath =
          path.join(
            __dirname,
            "../",
            existing[0].image
          );

        if (
          fs.existsSync(
            imagePath
          )
        ) {
          fs.unlinkSync(
            imagePath
          );
        }
      }

      // Delete additional images
      for (
        const img
        of productImages
      ) {

        const imagePath =
          path.join(
            __dirname,
            "../",
            img.image_url
          );

        if (
          fs.existsSync(
            imagePath
          )
        ) {
          fs.unlinkSync(
            imagePath
          );
        }
      }

      // Delete product
      await db.query(
        "DELETE FROM products WHERE id = ?",
        [id]
      );

      res.json({

        success: true,

        message:
          "Product deleted successfully",

        data: {
          id: parseInt(id)
        }
      });

    } catch (error) {

      console.error(
        "Error deleting product:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to delete product",
        error: error.message
      });
    }
  }
);

// =====================================================
// GET PRODUCTS BY CATEGORY
// =====================================================

router.get(
  "/products/category/:categoryId",
  async (req, res) => {

    try {

      const { categoryId } =
        req.params;

      const [rows] =
        await db.query(
          `SELECT
            p.id,
            p.name,
            p.category_id,
            c.name AS category,
            p.description,
            p.image,
            p.price,
            p.min_order_quantity,
            p.discount,
            p.status,
            p.created_at,
            p.updated_at
          FROM products p
          LEFT JOIN product_categories c
            ON p.category_id = c.id
          WHERE p.category_id = ?
          ORDER BY p.id DESC`,
          [categoryId]
        );

      const products = [];

      for (
        const product
        of rows
      ) {

        const [images] =
          await db.query(
            `SELECT image_url
             FROM product_images
             WHERE product_id = ?
             ORDER BY is_primary DESC, id ASC`,
            [product.id]
          );

        const imageUrls =
          images.map(
            (img) =>
              img.image_url
          );

        products.push({

          id:
            product.id,

          name:
            product.name,

          category_id:
            product.category_id,

          category:
            product.category ||
            "Uncategorized",

          description:
            product.description ||
            "",

          image:
            product.image ||
            (imageUrls.length > 0
              ? imageUrls[0]
              : ""),

          images:
            imageUrls,

          price:
            parseFloat(
              product.price
            ) || 0,

          min_order_quantity:
            parseInt(
              product.min_order_quantity
            ) || 1,

          discount:
            parseFloat(
              product.discount
            ) || 0,

          status:
            product.status === 1,

          createdAt:
            product.created_at,

          updatedAt:
            product.updated_at
        });
      }

      res.json({
        success: true,
        data: products
      });

    } catch (error) {

      console.error(
        "Error fetching products by category:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to fetch products",
        error: error.message
      });
    }
  }
);

// =====================================================
// TOGGLE PRODUCT STATUS
// =====================================================

router.patch(
  "/products/:id/status",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const { status } =
        req.body;

      if (
        status === undefined
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Status is required"
        });
      }

      const [existing] =
        await db.query(
          "SELECT id FROM products WHERE id = ?",
          [id]
        );

      if (existing.length === 0) {

        return res.status(404).json({
          success: false,
          message:
            "Product not found"
        });
      }

      const newStatus =
        parseStatus(status);

      await db.query(
        `UPDATE products
         SET status = ?
         WHERE id = ?`,
        [
          newStatus
            ? 1
            : 0,
          id
        ]
      );

      res.json({

        success: true,

        message:
          "Product status updated successfully",

        data: {

          id:
            parseInt(id),

          status:
            newStatus
        }
      });

    } catch (error) {

      console.error(
        "Error updating product status:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update product status",
        error: error.message
      });
    }
  }
);

// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;
