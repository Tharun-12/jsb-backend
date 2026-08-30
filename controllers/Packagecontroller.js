const db = require("../db");
const path = require("path");
const fs = require("fs");

// =====================================================
// HELPER: Parse status from form data
// =====================================================

const parseStatus = (status) => {
  if (
    status === undefined ||
    status === null
  ) {
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
// HELPER: Parse positive integer
// =====================================================

const parsePositiveInteger = (
  value
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    parseInt(value, 10);

  if (
    isNaN(parsed) ||
    parsed < 1
  ) {
    return null;
  }

  return parsed;
};

// =====================================================
// GET ALL PACKAGES WITH IMAGES
// =====================================================

exports.getAllPackages =
  async (req, res) => {

    try {

      const [rows] =
        await db.query(
          `SELECT p.*, 
            GROUP_CONCAT(DISTINCT pi.image_url) as images,
            (SELECT image_url
             FROM package_images
             WHERE package_id = p.id
             AND is_primary = 1
             LIMIT 1) as primary_image
           FROM packages p
           LEFT JOIN package_images pi
             ON p.id = pi.package_id
           GROUP BY p.id
           ORDER BY p.id DESC`
        );

      const packages =
        rows.map((pkg) => ({

          ...pkg,

          images:
            pkg.images
              ? pkg.images.split(",")
              : [],

          image:
            pkg.primary_image ||
            (
              pkg.images
                ? pkg.images.split(",")[0]
                : null
            ),

          price:
            parseFloat(
              pkg.price
            ) || 0,

          guest_count:
            parseInt(
              pkg.guest_count,
              10
            ) || 1,

          read_time:
            parseInt(
              pkg.read_time,
              10
            ) || 1,

          status:
            pkg.status === 1,

        }));

      res.json({
        success: true,
        data: packages,
      });

    } catch (err) {

      console.error(
        "Error fetching packages:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to fetch packages",

        error:
          err.message,

      });
    }
  };

// =====================================================
// GET SINGLE PACKAGE WITH IMAGES
// =====================================================

exports.getPackageById =
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const [packageRows] =
        await db.query(
          `SELECT p.*,
            (SELECT image_url
             FROM package_images
             WHERE package_id = p.id
             AND is_primary = 1
             LIMIT 1) as primary_image
           FROM packages p
           WHERE p.id = ?`,
          [id]
        );

      if (
        packageRows.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Package not found",

        });
      }

      const [imageRows] =
        await db.query(
          `SELECT
            id,
            image_url,
            is_primary
           FROM package_images
           WHERE package_id = ?
           ORDER BY is_primary DESC, id ASC`,
          [id]
        );

      const packageData = {

        id:
          packageRows[0].id,

        name:
          packageRows[0].name,

        category:
          packageRows[0].category,

        description:
          packageRows[0].description ||
          "",

        image:
          packageRows[0]
            .primary_image ||
          (
            imageRows.length > 0
              ? imageRows[0].image_url
              : null
          ),

        price:
          parseFloat(
            packageRows[0].price
          ) || 0,

        guest_count:
          parseInt(
            packageRows[0].guest_count,
            10
          ) || 1,

        read_time:
          parseInt(
            packageRows[0].read_time,
            10
          ) || 1,

        status:
          packageRows[0].status === 1,

        images:
          imageRows,

        created_at:
          packageRows[0].created_at,

        updated_at:
          packageRows[0].updated_at,

      };

      res.json({
        success: true,
        data: packageData,
      });

    } catch (err) {

      console.error(
        "Error fetching package:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to fetch package",

        error:
          err.message,

      });
    }
  };

// =====================================================
// CREATE PACKAGE WITH IMAGES
// =====================================================

exports.createPackage =
  async (req, res) => {

    const connection =
      await db.getConnection();

    try {

      await connection.beginTransaction();

      // =====================================================
      // GET FORM DATA
      // =====================================================

      const {
        name,
        category,
        description,
        price,
        guest_count,
        read_time,
        status,
        existingImages,
      } = req.body;

      console.log(
        "Request body:",
        req.body
      );

      console.log(
        "Request files:",
        req.files
      );

      // =====================================================
      // VALIDATE NAME
      // =====================================================

      if (
        !name ||
        !name.trim()
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Package name is required",

        });
      }

      // =====================================================
      // VALIDATE CATEGORY
      // =====================================================

      if (!category) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Category is required",

        });
      }

      // =====================================================
      // VALIDATE PRICE
      // =====================================================

      if (
        !price ||
        isNaN(price) ||
        parseFloat(price) < 0
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Valid price is required",

        });
      }

      // =====================================================
      // VALIDATE GUEST COUNT
      // =====================================================

      const guestCount =
        parsePositiveInteger(
          guest_count
        );

      if (
        guestCount === null
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Valid guest count is required",

        });
      }

      // =====================================================
      // VALIDATE READ TIME
      // =====================================================

      const readTime =
        parsePositiveInteger(
          read_time
        );

      if (
        readTime === null
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Valid read time is required",

        });
      }

      // =====================================================
      // PREPARE DATA
      // =====================================================

      const trimmedName =
        name.trim();

      const trimmedDescription =
        description
          ? description.trim()
          : "";

      const packageStatus =
        parseStatus(status);

      // =====================================================
      // HANDLE IMAGE UPLOADS
      // =====================================================

      const uploadedFiles =
        req.files || [];

      const newImageUrls =
        uploadedFiles.map(
          (file) =>
            `/uploads/packages/${file.filename}`
        );

      // =====================================================
      // PARSE EXISTING IMAGES
      // =====================================================

      let existingImageList = [];

      if (existingImages) {

        try {

          existingImageList =
            typeof existingImages ===
            "string"
              ? JSON.parse(
                  existingImages
                )
              : existingImages;

        } catch (e) {

          existingImageList = [];
        }
      }

      // =====================================================
      // COMBINE IMAGES
      // =====================================================

      const allImages = [
        ...existingImageList,
        ...newImageUrls,
      ];

      // =====================================================
      // SET MAIN IMAGE
      // =====================================================

      const mainImage =
        allImages.length > 0
          ? allImages[0]
          : "";

      // =====================================================
      // INSERT PACKAGE
      // =====================================================

      const [result] =
        await connection.query(
          `INSERT INTO packages
          (
            name,
            category,
            description,
            image,
            price,
            guest_count,
            read_time,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            trimmedName,
            category,
            trimmedDescription,
            mainImage,
            parseFloat(price),
            guestCount,
            readTime,
            packageStatus
              ? 1
              : 0,
          ]
        );

      const packageId =
        result.insertId;

      // =====================================================
      // INSERT PACKAGE IMAGES
      // =====================================================

      if (
        allImages.length > 0
      ) {

        const imageValues =
          allImages.map(
            (
              url,
              index
            ) => [
              packageId,
              url,
              index === 0
                ? 1
                : 0,
            ]
          );

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

      // =====================================================
      // COMMIT
      // =====================================================

      await connection.commit();

      // =====================================================
      // FETCH CREATED PACKAGE
      // =====================================================

      const [packageRows] =
        await connection.query(
          `SELECT p.*,
            (SELECT image_url
             FROM package_images
             WHERE package_id = p.id
             AND is_primary = 1
             LIMIT 1) as primary_image
           FROM packages p
           WHERE p.id = ?`,
          [packageId]
        );

      const [imageRows] =
        await connection.query(
          `SELECT
            id,
            image_url,
            is_primary
           FROM package_images
           WHERE package_id = ?
           ORDER BY is_primary DESC, id ASC`,
          [packageId]
        );

      const packageData = {

        id:
          packageRows[0].id,

        name:
          packageRows[0].name,

        category:
          packageRows[0].category,

        description:
          packageRows[0].description ||
          "",

        image:
          packageRows[0]
            .primary_image ||
          (
            imageRows.length > 0
              ? imageRows[0].image_url
              : null
          ),

        price:
          parseFloat(
            packageRows[0].price
          ) || 0,

        guest_count:
          parseInt(
            packageRows[0].guest_count,
            10
          ) || 1,

        read_time:
          parseInt(
            packageRows[0].read_time,
            10
          ) || 1,

        status:
          packageRows[0].status === 1,

        images:
          imageRows,

        created_at:
          packageRows[0].created_at,

        updated_at:
          packageRows[0].updated_at,

      };

      res.status(201).json({

        success: true,

        message:
          "Package created successfully",

        data:
          packageData,

      });

    } catch (err) {

      await connection.rollback();

      console.error(
        "Error creating package:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to create package",

        error:
          err.message,

      });

    } finally {

      connection.release();
    }
  };

// =====================================================
// UPDATE PACKAGE WITH IMAGES
// =====================================================

exports.updatePackage =
  async (req, res) => {

    const connection =
      await db.getConnection();

    try {

      await connection.beginTransaction();

      const { id } =
        req.params;

      const {
        name,
        category,
        description,
        price,
        guest_count,
        read_time,
        status,
        existingImages,
        imagesToRemove,
      } = req.body;

      console.log(
        "Update - Request body:",
        req.body
      );

      console.log(
        "Update - Request files:",
        req.files
      );

      // =====================================================
      // CHECK PACKAGE EXISTS
      // =====================================================

      const [existing] =
        await connection.query(
          `SELECT id, image
           FROM packages
           WHERE id = ?`,
          [id]
        );

      if (
        existing.length === 0
      ) {

        await connection.rollback();

        return res.status(404).json({

          success: false,

          message:
            "Package not found",

        });
      }

      // =====================================================
      // VALIDATE NAME
      // =====================================================

      if (
        !name ||
        !name.trim()
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Package name is required",

        });
      }

      // =====================================================
      // VALIDATE CATEGORY
      // =====================================================

      if (!category) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Category is required",

        });
      }

      // =====================================================
      // VALIDATE PRICE
      // =====================================================

      if (
        !price ||
        isNaN(price) ||
        parseFloat(price) < 0
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Valid price is required",

        });
      }

      // =====================================================
      // VALIDATE GUEST COUNT
      // =====================================================

      const guestCount =
        parsePositiveInteger(
          guest_count
        );

      if (
        guestCount === null
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Valid guest count is required",

        });
      }

      // =====================================================
      // VALIDATE READ TIME
      // =====================================================

      const readTime =
        parsePositiveInteger(
          read_time
        );

      if (
        readTime === null
      ) {

        await connection.rollback();

        return res.status(400).json({

          success: false,

          message:
            "Valid read time is required",

        });
      }

      // =====================================================
      // PREPARE DATA
      // =====================================================

      const trimmedName =
        name.trim();

      const trimmedDescription =
        description
          ? description.trim()
          : "";

      const packageStatus =
        parseStatus(status);

      // =====================================================
      // HANDLE NEW IMAGE UPLOADS
      // =====================================================

      const uploadedFiles =
        req.files || [];

      const newImageUrls =
        uploadedFiles.map(
          (file) =>
            `/uploads/packages/${file.filename}`
        );

      // =====================================================
      // PARSE EXISTING IMAGES
      // =====================================================

      let existingImageList = [];

      if (existingImages) {

        try {

          existingImageList =
            typeof existingImages ===
            "string"
              ? JSON.parse(
                  existingImages
                )
              : existingImages;

        } catch (e) {

          existingImageList = [];
        }
      }

      // =====================================================
      // PARSE IMAGES TO REMOVE
      // =====================================================

      let imagesToRemoveList = [];

      if (imagesToRemove) {

        try {

          imagesToRemoveList =
            typeof imagesToRemove ===
            "string"
              ? JSON.parse(
                  imagesToRemove
                )
              : imagesToRemove;

        } catch (e) {

          imagesToRemoveList = [];
        }
      }

      // =====================================================
      // GET CURRENT IMAGES
      // =====================================================

      const [currentImages] =
        await connection.query(
          `SELECT
            id,
            image_url
           FROM package_images
           WHERE package_id = ?`,
          [id]
        );

      // =====================================================
      // CURRENT IMAGE URLS
      // =====================================================

      const currentImageUrls =
        currentImages.map(
          (img) =>
            img.image_url
        );

      // =====================================================
      // FIND IMAGES TO DELETE
      // =====================================================

      const imagesToDelete =
        currentImageUrls.filter(
          (url) =>
            imagesToRemoveList.includes(
              url
            ) ||
            !existingImageList.includes(
              url
            )
        );

      // =====================================================
      // DELETE IMAGES
      // =====================================================

      for (
        const imageUrl
        of imagesToDelete
      ) {

        await connection.query(
          `DELETE FROM package_images
           WHERE package_id = ?
           AND image_url = ?`,
          [
            id,
            imageUrl,
          ]
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

      // =====================================================
      // COMBINE IMAGES
      // =====================================================

      const allImages = [
        ...existingImageList,
        ...newImageUrls,
      ];

      // =====================================================
      // INSERT NEW IMAGES
      // =====================================================

      if (
        newImageUrls.length > 0
      ) {

        const imageValues =
          newImageUrls.map(
            (url) => [
              id,
              url,
              0,
            ]
          );

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

      // =====================================================
      // UPDATE PRIMARY IMAGE
      // =====================================================

      if (
        allImages.length > 0
      ) {

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
          [
            id,
            allImages[0],
          ]
        );
      }

      // =====================================================
      // MAIN IMAGE
      // =====================================================

      const mainImage =
        allImages.length > 0
          ? allImages[0]
          : "";

      // =====================================================
      // UPDATE PACKAGE
      // =====================================================

      await connection.query(
        `UPDATE packages
         SET
           name = ?,
           category = ?,
           description = ?,
           image = ?,
           price = ?,
           guest_count = ?,
           read_time = ?,
           status = ?
         WHERE id = ?`,
        [
          trimmedName,
          category,
          trimmedDescription,
          mainImage,
          parseFloat(price),
          guestCount,
          readTime,
          packageStatus
            ? 1
            : 0,
          id,
        ]
      );

      // =====================================================
      // COMMIT
      // =====================================================

      await connection.commit();

      // =====================================================
      // FETCH UPDATED PACKAGE
      // =====================================================

      const [packageRows] =
        await connection.query(
          `SELECT p.*,
            (SELECT image_url
             FROM package_images
             WHERE package_id = p.id
             AND is_primary = 1
             LIMIT 1) as primary_image
           FROM packages p
           WHERE p.id = ?`,
          [id]
        );

      const [imageRows] =
        await connection.query(
          `SELECT
            id,
            image_url,
            is_primary
           FROM package_images
           WHERE package_id = ?
           ORDER BY is_primary DESC, id ASC`,
          [id]
        );

      const packageData = {

        id:
          packageRows[0].id,

        name:
          packageRows[0].name,

        category:
          packageRows[0].category,

        description:
          packageRows[0].description ||
          "",

        image:
          packageRows[0]
            .primary_image ||
          (
            imageRows.length > 0
              ? imageRows[0].image_url
              : null
          ),

        price:
          parseFloat(
            packageRows[0].price
          ) || 0,

        guest_count:
          parseInt(
            packageRows[0].guest_count,
            10
          ) || 1,

        read_time:
          parseInt(
            packageRows[0].read_time,
            10
          ) || 1,

        status:
          packageRows[0].status === 1,

        images:
          imageRows,

        created_at:
          packageRows[0].created_at,

        updated_at:
          packageRows[0].updated_at,

      };

      res.json({

        success: true,

        message:
          "Package updated successfully",

        data:
          packageData,

      });

    } catch (err) {

      await connection.rollback();

      console.error(
        "Error updating package:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to update package",

        error:
          err.message,

      });

    } finally {

      connection.release();
    }
  };

// =====================================================
// TOGGLE STATUS
// =====================================================

exports.toggleStatus =
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const [existing] =
        await db.query(
          "SELECT * FROM packages WHERE id = ?",
          [id]
        );

      if (
        existing.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Package not found",

        });
      }

      const newStatus =
        existing[0].status
          ? 0
          : 1;

      await db.query(
        `UPDATE packages
         SET status = ?
         WHERE id = ?`,
        [
          newStatus,
          id,
        ]
      );

      res.json({

        success: true,

        message:
          "Package status updated successfully",

        data: {

          id:
            parseInt(id),

          status:
            newStatus === 1,

        },

      });

    } catch (err) {

      console.error(
        "Error toggling status:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to toggle status",

        error:
          err.message,

      });
    }
  };

// =====================================================
// DELETE PACKAGE
// =====================================================

exports.deletePackage =
  async (req, res) => {

    try {

      const { id } =
        req.params;

      // =====================================================
      // CHECK PACKAGE
      // =====================================================

      const [existing] =
        await db.query(
          `SELECT id, image
           FROM packages
           WHERE id = ?`,
          [id]
        );

      if (
        existing.length === 0
      ) {

        return res.status(404).json({

          success: false,

          message:
            "Package not found",

        });
      }

      // =====================================================
      // GET PACKAGE IMAGES
      // =====================================================

      const [packageImages] =
        await db.query(
          `SELECT image_url
           FROM package_images
           WHERE package_id = ?`,
          [id]
        );

      // =====================================================
      // DELETE MAIN IMAGE
      // =====================================================

      if (
        existing[0].image
      ) {

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

      // =====================================================
      // DELETE ADDITIONAL IMAGES
      // =====================================================

      for (
        const img
        of packageImages
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

      // =====================================================
      // DELETE PACKAGE
      // =====================================================

      await db.query(
        "DELETE FROM packages WHERE id = ?",
        [id]
      );

      res.json({

        success: true,

        message:
          "Package deleted successfully",

        data: {

          id:
            parseInt(id),

        },

      });

    } catch (err) {

      console.error(
        "Error deleting package:",
        err
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to delete package",

        error:
          err.message,

      });
    }
  };

