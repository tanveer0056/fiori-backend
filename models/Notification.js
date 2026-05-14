const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['alert', 'info', 'success', 'error', 'task'],
    default: 'info'
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  tag: {
    type: String,
    enum: ['Complaints', 'Invoices', 'Purchase Orders', 'Payments', 'System', 'Compliance', 'Vendors', 'Finance'],
    default: 'System'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: {
    type: String
  },
  actions: [{
    label: String,
    primary: Boolean,
    url: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
