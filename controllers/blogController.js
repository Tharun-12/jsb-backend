const db = require("../db");

// GET /api/blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM blogs ORDER BY id DESC");
    res.json({ success: true, data: rows.map(mapBlog) });
  } catch (err) {
    console.error("getAllBlogs error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch blogs" });
  }
};

// GET /api/blogs/:id
exports.getBlogById = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM blogs WHERE id = ?", [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.json({ success: true, data: mapBlog(rows[0]) });
  } catch (err) {
    console.error("getBlogById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch blog" });
  }
};

// POST /api/blogs
exports.createBlog = async (req, res) => {
  try {
    const { title, slug, content, image, category, status } = req.body;

    if (!title || !slug || !category) {
      return res.status(400).json({ success: false, message: "Title, slug and category are required" });
    }

    const createdDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    const [result] = await db.query(
      `INSERT INTO blogs (title, slug, content, image, category, status, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        slug.trim().toLowerCase().replace(/\s+/g, "-"),
        content || "",
        (image || "").trim(),
        category,
        status || "Draft",
        createdDate,
      ]
    );

    const [rows] = await db.query("SELECT * FROM blogs WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, data: mapBlog(rows[0]) });
  } catch (err) {
    console.error("createBlog error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Slug already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create blog" });
  }
};

// PUT /api/blogs/:id
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, image, category, status } = req.body;

    await db.query(
      `UPDATE blogs SET title = ?, slug = ?, content = ?, image = ?, category = ?, status = ?
       WHERE id = ?`,
      [
        title.trim(),
        slug.trim().toLowerCase().replace(/\s+/g, "-"),
        content || "",
        (image || "").trim(),
        category,
        status,
        id,
      ]
    );

    const [rows] = await db.query("SELECT * FROM blogs WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.json({ success: true, data: mapBlog(rows[0]) });
  } catch (err) {
    console.error("updateBlog error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Slug already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to update blog" });
  }
};

// PATCH /api/blogs/:id/status
exports.toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT status FROM blogs WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }

    const newStatus = rows[0].status === "Published" ? "Draft" : "Published";
    await db.query("UPDATE blogs SET status = ? WHERE id = ?", [newStatus, id]);

    res.json({ success: true, data: { id: Number(id), status: newStatus } });
  } catch (err) {
    console.error("toggleStatus error:", err);
    res.status(500).json({ success: false, message: "Failed to toggle status" });
  }
};

// DELETE /api/blogs/:id
exports.deleteBlog = async (req, res) => {
  try {
    const [result] = await db.query("DELETE FROM blogs WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    res.json({ success: true, message: "Blog deleted" });
  } catch (err) {
    console.error("deleteBlog error:", err);
    res.status(500).json({ success: false, message: "Failed to delete blog" });
  }
};

function mapBlog(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content || "",
    image: row.image || "",
    category: row.category,
    status: row.status,
    createdDate: row.created_date,
  };
}