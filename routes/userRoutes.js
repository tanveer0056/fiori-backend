const express = require('express');
const router = express.Router();
const { getVendors, createVendor, createUser, getUsers, changePassword, getAllUsers, deleteUsers, updateUser } = require('../controllers/userController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Notification routes are now handled in notificationRoutes.js


router.route('/')
  .get(protect, adminOnly, getUsers);

router.route('/all')
  .get(protect, adminOnly, getAllUsers);

router.route('/add')
  .post(protect, adminOnly, createUser);

router.route('/bulk-delete')
  .post(protect, adminOnly, deleteUsers);

router.route('/vendors')
  .get(protect, adminOnly, getVendors)
  .post(protect, adminOnly, createVendor);

router.route('/profile/password')
  .put(protect, changePassword);

router.route('/:id')
  .put(protect, adminOnly, updateUser);

module.exports = router;
