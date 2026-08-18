const express = require("express");
const router = express.Router();
const sectionController = require("../controllers/sectionController");

router.get("/", sectionController.getAllSections);
router.get("/:id", sectionController.getSectionById);
router.post("/", sectionController.createSection);
router.put("/:id", sectionController.updateSection);
router.patch("/:id/status", sectionController.toggleStatus);
router.delete("/:id", sectionController.deleteSection);

router.get("/:id/content", sectionController.getContent);
router.put("/:id/content", sectionController.saveContent);
router.delete("/:id/content", sectionController.resetContent);

router.get("/:id/customization", sectionController.getCustomization);
router.put("/:id/customization", sectionController.saveCustomization);
router.delete("/:id/customization", sectionController.resetCustomization);

module.exports = router;