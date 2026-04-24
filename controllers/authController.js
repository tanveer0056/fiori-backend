const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');

const generateToken = (userId, organizationId, role, staySignedIn = false) => {
  const expiresIn = staySignedIn ? process.env.JWT_REFRESH_EXPIRES_IN : process.env.JWT_EXPIRES_IN;
  return jwt.sign({ userId, organizationId, role }, process.env.JWT_SECRET, {
    expiresIn,
  });
};

// @desc    Register a new Organization and Admin user
// @route   POST /api/auth/register
exports.registerOrganization = async (req, res) => {
  const { orgName, email, password } = req.body;
  try {
    const orgExists = await Organization.findOne({ name: orgName });
    if (orgExists) {
      return res.status(400).json({ message: 'Organization already exists' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const organization = await Organization.create({ name: orgName });

    const user = await User.create({
      email,
      password,
      role: 'Admin',
      organizationId: organization._id
    });

    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      token: generateToken(user._id, organization._id, user.role, false)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Check if email exists (Microsoft Step 1)
// @route   POST /api/auth/check-email
exports.checkEmail = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      res.json({ exists: true });
    } else {
      res.status(404).json({ exists: false, message: 'Account not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Auth user & get token (Microsoft Step 2 + Step 3)
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  const { email, password, staySignedIn } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        vendorDetails: user.vendorDetails,
        token: generateToken(user._id, user.organizationId, user.role, staySignedIn)
      });
    } else {
      res.status(401).json({ message: 'Invalid password' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
