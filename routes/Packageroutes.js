const express = require("express");
const router = express.Router();
const {
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  toggleStatus,
  deletePackage,
} = require("../controllers/packageController");

router.get("/", getAllPackages);
router.get("/:id", getPackageById);
router.post("/", createPackage);
router.put("/:id", updatePackage);
router.patch("/:id/status", toggleStatus);
router.delete("/:id", deletePackage);

module.exports = router;