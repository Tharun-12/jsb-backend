const db = require("../db");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../uploads/blogs");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Helper: safely delete a file
const deleteFile = (relativePath) => {
  if (!relativePath) return;
  try {
    const absolutePath = path.join(__dirname, "..", relativePath);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (err) {
    console.warn("Failed to delete file:", relativePath, err.message);
  }
};

// GET /api/blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM blogs ORDER BY id DESC");
    const blogs = await Promise.all(rows.map(mapBlogWithImages));
    res.json({ success: true, data: blogs });
  } catch (err) {
    console.error("getAllBlogs error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch blogs" });
  }
};

// GET /api/blogs/:id
exports.getBlogById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM blogs WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }
    const blog = await mapBlogWithImages(rows[0]);
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error("getBlogById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch blog" });
  }
};

// POST /api/blogs
exports.createBlog = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      title,
      slug,
      content,
      category,
      status,
      author,
      tag_line,
      read_time,
    } = req.body;

    if (!title || !slug || !category) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Title, slug and category are required",
      });
    }

    const featuredFile = req.files?.featured_image?.[0];
    const image = featuredFile
      ? `/uploads/blogs/${featuredFile.filename}`
      : "";

    const createdDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const [result] = await connection.query(
      `INSERT INTO blogs (title, slug, content, image, category, status, created_date, author, tag_line, read_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        slug.trim().toLowerCase().replace(/\s+/g, "-"),
        content || "",
        image,
        category,
        status || "Draft",
        createdDate,
        author || "",
        tag_line || "",
        read_time || "",
      ]
    );

    const blogId = result.insertId;

    // Save any additional images (everything besides the cover)
    const galleryFiles = req.files?.gallery_images || [];
    if (galleryFiles.length > 0) {
      const values = galleryFiles.map((file, index) => [
        blogId,
        `/uploads/blogs/${file.filename}`,
        0,
        index,
      ]);
      await connection.query(
        `INSERT INTO blog_images (blog_id, image_path, is_featured, display_order) VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    const [rows] = await connection.query(
      "SELECT * FROM blogs WHERE id = ?",
      [blogId]
    );
    const blog = await mapBlogWithImages(rows[0]);
    res.status(201).json({ success: true, data: blog });
  } catch (err) {
    await connection.rollback();
    console.error("createBlog error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to create blog" });
  } finally {
    connection.release();
  }
};

// PUT /api/blogs/:id
exports.updateBlog = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      title,
      slug,
      content,
      category,
      status,
      author,
      tag_line,
      read_time,
    } = req.body;

    // Sent by the frontend when the cover image is an existing
    // blog_images row being promoted to become the new blogs.image.
    const promoteGalleryImageId = req.body.promote_gallery_image_id;
    // "1" when the user removed the original cover image entirely
    // (i.e. it should be deleted, not demoted into the gallery).
    const originalFeaturedRemoved =
      req.body.original_featured_removed === "1";

    const [existingRows] = await connection.query(
      "SELECT image FROM blogs WHERE id = ?",
      [id]
    );
    if (existingRows.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    let image = existingRows[0].image;
    const oldFeaturedImage = image;
    const featuredFile = req.files?.featured_image?.[0];

    if (featuredFile) {
      // A brand-new file was uploaded as the cover.
      if (oldFeaturedImage) {
        if (originalFeaturedRemoved) {
          // User explicitly removed the old cover -> delete the file.
          deleteFile(oldFeaturedImage);
        } else {
          // Keep the old cover, just demote it into the gallery so it
          // isn't lost.
          await connection.query(
            `INSERT INTO blog_images (blog_id, image_path, is_featured, display_order) VALUES (?, ?, 0, 9999)`,
            [id, oldFeaturedImage]
          );
        }
      }
      image = `/uploads/blogs/${featuredFile.filename}`;
    } else if (promoteGalleryImageId) {
      // An existing gallery image is being promoted to become the cover.
      const [promoRows] = await connection.query(
        "SELECT image_path FROM blog_images WHERE id = ? AND blog_id = ?",
        [promoteGalleryImageId, id]
      );

      if (promoRows.length > 0) {
        const newFeaturedPath = promoRows[0].image_path;

        if (oldFeaturedImage) {
          if (originalFeaturedRemoved) {
            deleteFile(oldFeaturedImage);
          } else {
            await connection.query(
              `INSERT INTO blog_images (blog_id, image_path, is_featured, display_order) VALUES (?, ?, 0, 9999)`,
              [id, oldFeaturedImage]
            );
          }
        }

        // Remove the promoted row from blog_images since it now lives
        // in blogs.image instead.
        await connection.query("DELETE FROM blog_images WHERE id = ?", [
          promoteGalleryImageId,
        ]);
        image = newFeaturedPath;
      }
    } else if (originalFeaturedRemoved && oldFeaturedImage) {
      // Cover removed and nothing replaced/promoted it.
      deleteFile(oldFeaturedImage);
      image = "";
    }

    await connection.query(
      `UPDATE blogs SET 
        title = ?, slug = ?, content = ?, image = ?, category = ?, 
        status = ?, author = ?, tag_line = ?, read_time = ?
       WHERE id = ?`,
      [
        title.trim(),
        slug.trim().toLowerCase().replace(/\s+/g, "-"),
        content || "",
        image,
        category,
        status,
        author || "",
        tag_line || "",
        read_time || "",
        id,
      ]
    );

    // Get existing gallery count for ordering new rows correctly
    const [existingGallery] = await connection.query(
      "SELECT COUNT(*) as count FROM blog_images WHERE blog_id = ?",
      [id]
    );
    let startOrder = existingGallery[0].count;

    // Add any brand-new additional images (everything not chosen as cover)
    const galleryFiles = req.files?.gallery_images || [];
    if (galleryFiles.length > 0) {
      const values = galleryFiles.map((file, index) => [
        id,
        `/uploads/blogs/${file.filename}`,
        0,
        startOrder + index,
      ]);
      await connection.query(
        `INSERT INTO blog_images (blog_id, image_path, is_featured, display_order) VALUES ?`,
        [values]
      );
    }

    await connection.commit();

    const [rows] = await connection.query(
      "SELECT * FROM blogs WHERE id = ?",
      [id]
    );
    const blog = await mapBlogWithImages(rows[0]);
    res.json({ success: true, data: blog });
  } catch (err) {
    await connection.rollback();
    console.error("updateBlog error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists" });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to update blog" });
  } finally {
    connection.release();
  }
};

// DELETE gallery image (or a former-cover image demoted into blog_images)
exports.deleteGalleryImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const [rows] = await db.query(
      "SELECT image_path FROM blog_images WHERE id = ?",
      [imageId]
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Image not found" });
    }
    deleteFile(rows[0].image_path);
    await db.query("DELETE FROM blog_images WHERE id = ?", [imageId]);
    res.json({ success: true, message: "Image deleted" });
  } catch (err) {
    console.error("deleteGalleryImage error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete image" });
  }
};

// PATCH /api/blogs/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT status FROM blogs WHERE id = ?", [
      id,
    ]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }
    const newStatus = rows[0].status === "Published" ? "Draft" : "Published";
    await db.query("UPDATE blogs SET status = ? WHERE id = ?", [
      newStatus,
      id,
    ]);
    res.json({ success: true, data: { id: Number(id), status: newStatus } });
  } catch (err) {
    console.error("toggleStatus error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to toggle status" });
  }
};

// DELETE /api/blogs/:id
exports.deleteBlog = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT image FROM blogs WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    // Get all additional images
    const [galleryRows] = await db.query(
      "SELECT image_path FROM blog_images WHERE blog_id = ?",
      [req.params.id]
    );

    await db.query("DELETE FROM blogs WHERE id = ?", [req.params.id]);

    // Delete files
    if (rows[0].image) deleteFile(rows[0].image);
    galleryRows.forEach((g) => deleteFile(g.image_path));

    res.json({ success: true, message: "Blog deleted" });
  } catch (err) {
    console.error("deleteBlog error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete blog" });
  }
};

// Map blog with its additional images
async function mapBlogWithImages(row) {
  const [images] = await db.query(
    "SELECT id, image_path, is_featured, display_order FROM blog_images WHERE blog_id = ? ORDER BY display_order ASC, id ASC",
    [row.id]
  );
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content || "",
    image: row.image || "",
    category: row.category,
    status: row.status,
    createdDate: row.created_date,
    author: row.author || "",
    tag_line: row.tag_line || "",
    read_time: row.read_time || "",
    images: images.map((img) => ({
      id: img.id,
      path: img.image_path,
      is_featured: Boolean(img.is_featured),
      display_order: img.display_order,
    })),
  };
}