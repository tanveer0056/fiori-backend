const User = require('../models/User');

// @desc    Get all internal users (Admins)
// @route   GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ organizationId: req.user.organizationId, role: 'Admin' }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// @desc    Create an Admin user account
// @route   POST /api/users/add
exports.createUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const newUser = await User.create({
      email,
      password,
      role: 'Admin',
      organizationId: req.user.organizationId
    });

    res.status(201).json({ _id: newUser._id, email: newUser.email });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get all vendors in the organization
// @route   GET /api/users/vendors
exports.getVendors = async (req, res) => {
  try {
    const vendors = await User.find({ organizationId: req.user.organizationId, role: 'Vendor' }).select('-password');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a vendor account
// @route   POST /api/users/vendors
exports.createVendor = async (req, res) => {
  const { email, password, vendorName, vendorCompany, allowModification } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const vendor = await User.create({
      email,
      password,
      role: 'Vendor',
      organizationId: req.user.organizationId,
      vendorDetails: { name: vendorName, company: vendorCompany },
      allowTicketModification: allowModification || false
    });

    res.status(201).json({ _id: vendor._id, email: vendor.email });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Change user password natively
// @route   PUT /api/users/profile/password
// @access  Private (All authenticated users)
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
