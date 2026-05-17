const User = require('../models/User');
const Chat = require('../models/Chat');
const { createNotification } = require('./notificationController');

// @desc    Get all internal users (Admins)
// @route   GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ organizationId: req.user.organizationId, role: { $in: ['Admin', 'General User'] } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// @desc    Get all users (Admins, General Users, Vendors)
// @route   GET /api/users/all
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ organizationId: req.user.organizationId }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching all users' });
  }
};

// @desc    Create an Admin user account
// @route   POST /api/users/add
exports.createUser = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const newUser = await User.create({
      username,
      email,
      password,
      role: 'General User',
      organizationId: req.user.organizationId
    });

    // Add new user to all existing vendor group chats in the org
    await Chat.updateMany(
      { organizationId: req.user.organizationId, isGroup: true },
      { $addToSet: { members: newUser._id } }
    );

    res.status(201).json({ _id: newUser._id, username: newUser.username, email: newUser.email });
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

    // Create a group chat for the vendor
    const allOrgUsers = await User.find({ 
      organizationId: req.user.organizationId,
      role: { $in: ['Admin', 'General User'] }
    }).select('_id');
    
    const memberIds = allOrgUsers.map(u => u._id);
    memberIds.push(vendor._id);

    await Chat.create({
      name: vendorName || vendorCompany || 'Vendor Group',
      isGroup: true,
      organizationId: req.user.organizationId,
      vendorId: vendor._id,
      members: memberIds
    });

    // Send Welcome Notification
    await createNotification(req, {
      recipient: vendor._id,
      sender: req.user.userId,
      type: 'success',
      title: 'Welcome to Fiori!',
      body: `Your vendor account has been successfully created. You can now track invoices and manage complaints.`,
      tag: 'Vendors',
      link: '/app/profile'
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

// @desc    Update any user's profile/credentials
// @route   PUT /api/users/:id
// @access  Admin only
exports.updateUser = async (req, res) => {
  const { username, email, password, role, vendorName, vendorCompany, allowModification } = req.body;
  try {
    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update base fields
    if (username !== undefined) userToUpdate.username = username;
    if (email !== undefined) userToUpdate.email = email;
    if (role !== undefined) userToUpdate.role = role;
    
    // Update vendor specific fields if applicable
    if (userToUpdate.role === 'Vendor') {
      if (!userToUpdate.vendorDetails) userToUpdate.vendorDetails = {};
      if (vendorName !== undefined) userToUpdate.vendorDetails.name = vendorName;
      if (vendorCompany !== undefined) userToUpdate.vendorDetails.company = vendorCompany;
      if (allowModification !== undefined) userToUpdate.allowTicketModification = allowModification;
    }

    // Update password if provided
    if (password && password.trim().length > 0) {
      userToUpdate.password = password;
    }

    await userToUpdate.save();

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error updating user' });
  }
};

// @desc    Bulk delete users
// @route   POST /api/users/bulk-delete
// @access  Admin only
exports.deleteUsers = async (req, res) => {
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ message: 'No user IDs provided' });
  }

  try {
    await User.deleteMany({
      _id: { $in: userIds },
      organizationId: req.user.organizationId
    });
    res.json({ message: 'Users deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error deleting users' });
  }
};

// @desc    Get online user IDs
// @route   GET /api/users/online
exports.getOnlineUsers = async (req, res) => {
  try {
    // Users active in the last 2 minutes are considered online
    const threshold = new Date(Date.now() - 2 * 60 * 1000);
    const onlineUsers = await User.find({ 
      organizationId: req.user.organizationId,
      lastActive: { $gte: threshold }
    }).select('_id');
    
    res.json(onlineUsers.map(u => u._id));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching online status' });
  }
};

