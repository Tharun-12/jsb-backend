const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");

const db = require("./db");
const categoryRoutes = require("./routes/productCategories");
const productRoutes = require("./routes/productRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const serviceRoutes = require("./routes/serviceRoutes"); 
const programRoutes = require("./routes/programRoutes");
const globalSearchRoutes = require("./routes/globalSearchRoutes");
const packageCategoryRoutes = require("./routes/packageCategoryRoutes");
const packageRoutes = require("./routes/packageRoutes");
const pageRoutes = require("./routes/pageRoutes"); 
const sectionRoutes = require("./routes/sectionRoutes");
const blogRoutes = require("./routes/blogRoutes");
const enquiryRoute = require("./routes/EnquiryRoute")
const orderRoute = require("./routes/ordersRoutes")


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files (uploaded images) — this is what makes
// /uploads/logos/logo-xxx.png publicly reachable in the browser
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api", categoryRoutes);
app.use("/api", productRoutes);
app.use("/api", settingsRoutes);
app.use("/api", serviceRoutes);
app.use("/api", programRoutes); 

app.use("/api/admin", globalSearchRoutes);
app.use("/api/package-categories", packageCategoryRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/sections", sectionRoutes); 
app.use("/api/blogs", blogRoutes);

app.use("/api", enquiryRoute);
app.use("/api", orderRoute);


// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" });
});

// 404 handler for unmatched API routes (helps distinguish
// "wrong URL" from "server error" while debugging)
app.use("/api", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});