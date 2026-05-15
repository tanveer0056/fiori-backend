const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  ticketNo: { type: String, unique: true }, // e.g., TKT-2024-001
  category: { 
    type: String, 
    enum: ['Hardware', 'Software', 'Network', 'Service', 'Maintenance', 'Other'],
    default: 'Service'
  },
  subCategory: { type: String },
  natureOfWork: { type: String },
  siteLocation: { type: String },
  pocDetails: { type: String },
  requestedBy: { type: String },
  contactNumber: { type: String },
  onBehalfOf: { type: String },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium'
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Closed'],
    default: 'Open'
  },
  dueDate: { type: Date }, // SLA tracking
  resolvedAt: { type: Date },
  resolutionCategory: { type: String },
  customerAccountId: { type: String, required: true },
  assignedVendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // only users with role='Vendor'
    required: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  tags: [{ type: String }],
  comments: [{
    text: String,
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Pre-save hook to generate ticketNo if not exists
ticketSchema.pre('save', async function () {
  if (this.isNew && !this.ticketNo) {
    try {
      const date = new Date();
      const year = date.getFullYear();
      const count = await this.constructor.countDocuments({ organizationId: this.organizationId });
      this.ticketNo = `TKT-${year}-${(count + 1).toString().padStart(4, '0')}`;
    } catch (err) {
      console.error('Error generating ticketNo:', err);
    }
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);
