const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  active: {
    type: Boolean,
    default: true
  },
  emailConfig: {
    senderEmail: { type: String, trim: true },
    smtpServer: { type: String, trim: true },
    smtpPassword: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Organization', organizationSchema);
