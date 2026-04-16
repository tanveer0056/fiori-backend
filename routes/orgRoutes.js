const express = require('express');
const router = express.Router();
const { getOrgConfig, updateOrgEmailConfig } = require('../controllers/orgController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.route('/config')
  .get(protect, adminOnly, getOrgConfig)
  .put(protect, adminOnly, updateOrgEmailConfig);

module.exports = router;
