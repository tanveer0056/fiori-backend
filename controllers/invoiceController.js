const Invoice = require('../models/Invoice');
const { createNotification } = require('./notificationController');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Admin
exports.getInvoices = async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.user.role === 'Vendor') filter.vendorId = req.user.userId;
    
    let dbQuery = Invoice.find(filter).populate('vendorId', 'email vendorDetails');

    if (req.query.sort === 'desc' || req.query.sort === 'raisedDate:desc') {
      dbQuery = dbQuery.sort({ createdAt: -1 });
    }

    if (req.query.limit) {
      dbQuery = dbQuery.limit(parseInt(req.query.limit, 10));
    }

    const invoices = await dbQuery.exec();
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get invoice summary
// @route   GET /api/invoices/stage-summary
// @access  Admin
exports.getInvoiceSummary = async (req, res) => {
  try {
    const filter = { organizationId: req.user.organizationId };
    if (req.user.role === 'Vendor') filter.vendorId = req.user.userId;
    const invoices = await Invoice.find(filter);

    const pendingInvoices = invoices.filter(i => i.paymentStatus !== 'Paid');
    const pendingCount = pendingInvoices.length;
    const pendingAmount = pendingInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);

    const stages = { 'Procurement': 0, 'MNR': 0, 'Accounts': 0, 'Paid': 0 };

    invoices.forEach(i => {
      if (i.paymentStatus === 'Paid') {
        stages['Paid']++;
      } else if (i.currentDepartment === 'Procurement') {
        stages['Procurement']++;
      } else if (i.currentDepartment === 'Project' || i.currentDepartment === 'MNR') {
        stages['MNR']++;
      } else if (i.currentDepartment === 'Accounts') {
        stages['Accounts']++;
      }
    });

    const total = invoices.length || 1;
    const stageSummary = [
      { name: 'Procurement', count: stages['Procurement'], percentage: Math.round((stages['Procurement']/total)*100), color: 'bg-blue-500' },
      { name: 'MNR', count: stages['MNR'], percentage: Math.round((stages['MNR']/total)*100), color: 'bg-purple-500' },
      { name: 'Accounts', count: stages['Accounts'], percentage: Math.round((stages['Accounts']/total)*100), color: 'bg-amber-500' },
      { name: 'Paid', count: stages['Paid'], percentage: Math.round((stages['Paid']/total)*100), color: 'bg-green-500' }
    ];

    res.json({
      pendingCount,
      pendingAmount,
      stageSummary
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create an invoice tracking entry
// @route   POST /api/invoices
// @access  Admin
exports.createInvoice = async (req, res) => {
  if (req.user.role === 'General User') {
    return res.status(403).json({ message: 'General Users cannot create invoices' });
  }
  const { documentNo, documentDate, submissionDate, amount, vendorId, currentDepartment } = req.body;
  try {
    const isVendor = req.user.role === 'Vendor';
    const finalVendorId = isVendor ? req.user.userId : vendorId;
    const finalDept = isVendor ? 'Procurement' : (currentDepartment || 'Procurement');

    const invoice = await Invoice.create({
      documentNo,
      documentDate,
      submissionDate,
      amount,
      vendorId: finalVendorId,
      currentDepartment: finalDept,
      departmentHistory: [{ department: finalDept, dateEntered: submissionDate ? new Date(submissionDate) : Date.now() }],
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
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admins can update invoices' });
  }
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
    const oldStatus = invoice.paymentStatus;
    if (paymentStatus) invoice.paymentStatus = paymentStatus;
    if (paymentReference) invoice.paymentReference = paymentReference;

    await invoice.save();

    // Notify vendor if payment marked as Paid
    if (paymentStatus === 'Paid' && oldStatus !== 'Paid') {
      await createNotification(req, {
        recipient: invoice.vendorId,
        sender: req.user.userId,
        type: 'success',
        title: 'Invoice Paid',
        body: `Your invoice #${invoice.documentNo} for amount ${invoice.amount} has been marked as Paid. Reference: ${paymentReference || 'N/A'}`,
        tag: 'Payments',
        link: '/app/invoice-tracker'
      });
    }

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete invoice tracking entry
// @route   DELETE /api/invoices/:id
// @access  Admin
exports.deleteInvoice = async (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ message: 'Only Admins can delete invoices' });
  }
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
