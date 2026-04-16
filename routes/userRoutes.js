const express = require('express');
const router = express.Router();
const { getVendors, createVendor, createUser, getUsers } = require('../controllers/userController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, adminOnly, getUsers);

router.route('/add')
  .post(protect, adminOnly, createUser);

router.route('/vendors')
  .get(protect, adminOnly, getVendors)
  .post(protect, adminOnly, createVendor);

module.exports = router;
