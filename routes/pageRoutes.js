const express = require("express");
const router = express.Router();
const pageController = require("../controllers/pageController");

router.get("/", pageController.getAllPages);
router.get("/:id", pageController.getPageById); 
router.post("/", pageController.createPage);
router.put("/:id", pageController.updatePage);
router.patch("/:id/status", pageController.toggleStatus);
router.delete("/:id", pageController.deletePage);

module.exports = router;