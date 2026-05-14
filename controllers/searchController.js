const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const User = require('../models/User');

// @desc    Global search across tickets, invoices, and vendors
// @route   GET /api/search
exports.globalSearch = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ results: [] });

  try {
    const orgId = req.user.organizationId;
    const isVendor = req.user.role === 'Vendor';
    const userId = req.user.userId;

    const regex = new RegExp(q, 'i');

    // 1. Search Tickets
    const ticketQuery = { 
      organizationId: orgId,
      $or: [{ title: regex }, { description: regex }]
    };
    if (isVendor) ticketQuery.assignedVendorId = userId;
    const tickets = await Ticket.find(ticketQuery).limit(5);

    // 2. Search Invoices
    const invoiceQuery = { 
      organizationId: orgId,
      $or: [{ documentNo: regex }, { paymentReference: regex }]
    };
    if (isVendor) invoiceQuery.vendorId = userId;
    const invoices = await Invoice.find(invoiceQuery).limit(5);

    // 3. Search Users/Vendors (Admin only or limited for vendors)
    let users = [];
    if (!isVendor) {
      users = await User.find({
        organizationId: orgId,
        $or: [{ username: regex }, { email: regex }, { 'vendorDetails.name': regex }]
      }).limit(5).select('username email role vendorDetails');
    }

    // Format results
    const results = [
      ...tickets.map(t => ({
        id: t._id,
        title: t.title,
        type: 'Ticket',
        link: `/app/complaints/${t._id}`,
        icon: 'Activity'
      })),
      ...invoices.map(i => ({
        id: i._id,
        title: `Invoice #${i.documentNo}`,
        type: 'Invoice',
        link: '/app/invoice-tracker',
        icon: 'FileText'
      })),
      ...users.map(u => ({
        id: u._id,
        title: u.role === 'Vendor' ? (u.vendorDetails?.name || u.email) : (u.username || u.email),
        type: 'User',
        link: '/app/admin',
        icon: 'User'
      }))
    ];

    res.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};
