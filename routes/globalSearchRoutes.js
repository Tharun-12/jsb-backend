const express = require("express");

const router = express.Router();

const {
  globalSearch
} = require("../controllers/globalSearchController");

router.get("/global-search", globalSearch);

module.exports = router;