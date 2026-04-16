const Invoice = require('../models/Invoice');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Admin
exports.getInvoices = async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.user.role === 'Vendor') filter.vendorId = req.user.userId;
    const invoices = await Invoice.find(filter).populate('vendorId', 'email vendorDetails');
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create an invoice tracking entry
// @route   POST /api/invoices
// @access  Admin
exports.createInvoice = async (req, res) => {
  const { documentNo, documentDate, submissionDate, amount, vendorId, currentDepartment } = req.body;
  try {
    const invoice = await Invoice.create({
      documentNo,
      documentDate,
      submissionDate,
      amount,
      vendorId,
      currentDepartment,
      departmentHistory: [{ department: currentDepartment || 'Procurement', dateEntered: submissionDate ? new Date(submissionDate) : Date.now() }],
      organizationId: req.user.organizationId
    });
    res.status(201).json(invoice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update invoice (shift department, update payment)
// @route   PUT /api/invoices/:id
// @access  Admin
exports.updateInvoice = async (req, res) => {
  const { currentDepartment, paymentStatus, paymentReference } = req.body;
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Not found' });
    
    if (invoice.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (currentDepartment && invoice.currentDepartment !== currentDepartment) {
      invoice.currentDepartment = currentDepartment;
      invoice.departmentHistory.push({ department: currentDepartment, dateEntered: Date.now() });
    }
    if (paymentStatus) invoice.paymentStatus = paymentStatus;
    if (paymentReference) invoice.paymentReference = paymentReference;

    await invoice.save();
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete invoice tracking entry
// @route   DELETE /api/invoices/:id
// @access  Admin
exports.deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Not found' });
    if (invoice.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    
    await invoice.deleteOne();
    res.json({ message: 'Invoice completely deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
