const express = require('express');
const router = express.Router();
const { getVendors, createVendor, createUser, getUsers, changePassword } = require('../controllers/userController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, adminOnly, getUsers);

router.route('/add')
  .post(protect, adminOnly, createUser);

router.route('/vendors')
  .get(protect, adminOnly, getVendors)
  .post(protect, adminOnly, createVendor);

router.route('/profile/password')
  .put(protect, changePassword);

module.exports = router;
