const express = require('express');
const router = express.Router();
const { registerOrganization, checkEmail, loginUser } = require('../controllers/authController');

router.post('/register', registerOrganization);
router.post('/check-email', checkEmail);
router.post('/login', loginUser);

module.exports = router;
