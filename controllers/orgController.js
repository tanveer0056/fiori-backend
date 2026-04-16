const Organization = require('../models/Organization');

exports.getOrgConfig = async (req, res) => {
  try {
    const org = await Organization.findById(req.user.organizationId);
    res.json(org);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateOrgEmailConfig = async (req, res) => {
  const { senderEmail, smtpServer, smtpPassword } = req.body;
  try {
    const org = await Organization.findById(req.user.organizationId);
    org.emailConfig = { senderEmail, smtpServer, smtpPassword };
    await org.save();
    res.json(org);
  } catch (error) {
    res.status(500).json({ message: 'Server error tracking settings' });
  }
};
