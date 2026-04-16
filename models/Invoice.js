const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  documentNo: { type: String, required: true },
  documentDate: { type: Date, required: true },
  submissionDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // the user representing the vendor
    required: true
  },
  currentDepartment: {
    type: String,
    enum: ['Procurement', 'Accounts', 'MNR', 'Project'],
    default: 'Procurement'
  },
  departmentHistory: [{
    department: { type: String },
    dateEntered: { type: Date, default: Date.now }
  }],
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  paymentReference: {
    type: String
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
