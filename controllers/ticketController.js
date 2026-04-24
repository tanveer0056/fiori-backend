const Ticket = require('../models/Ticket');

// @desc    Get tickets
// @route   GET /api/tickets
// @access  Admin/Vendor
exports.getTickets = async (req, res) => {
  try {
    let query = { organizationId: req.user.organizationId };
    
    // Vendor can only see their own tickets
    if (req.user.role === 'Vendor') {
      query.assignedVendorId = req.user.userId;
    }

    const tickets = await Ticket.find(query)
        .populate('assignedVendorId', 'email vendorDetails')
        .populate('comments.postedBy', 'email role');
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Admin/Vendor
exports.getTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
        .populate('assignedVendorId', 'email vendorDetails')
        .populate('comments.postedBy', 'email role vendorDetails');
        
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    
    if (ticket.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    if (req.user.role === 'Vendor' && ticket.assignedVendorId._id.toString() !== req.user.userId.toString()) {
      return res.status(401).json({ message: 'Not your assigned ticket' });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Create a new ticket
// @route   POST /api/tickets
// @access  Admin only
exports.createTicket = async (req, res) => {
  const { title, description, customerAccountId, assignedVendorId, natureOfWork, siteLocation, pocDetails, priority } = req.body;

  try {
    const ticket = await Ticket.create({
      title,
      description,
      customerAccountId,
      assignedVendorId,
      natureOfWork,
      siteLocation,
      pocDetails,
      priority: priority || 'Medium',
      organizationId: req.user.organizationId
    });
    
    // Simulate email dispatch hook here
    console.log(`[Email Mock] Sending assignment email to vendor ID ${assignedVendorId} for ticket ${ticket._id}`);

    res.status(201).json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Update a ticket
// @route   PUT /api/tickets/:id
// @access  Admin/Vendor
exports.updateTicket = async (req, res) => {
  const { status, addComment } = req.body;
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Not found' });

    if (ticket.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'Vendor') {
      // Check if vendor has permission internally (skip deep check logic for brevity, assume passed to client)
      if (ticket.assignedVendorId.toString() !== req.user.userId.toString()) {
        return res.status(401).json({ message: 'Not your ticket' });
      }
    }

    if (status) {
      ticket.status = status;
      if (status === 'Closed' && !ticket.resolvedAt) {
        ticket.resolvedAt = Date.now();
      }
    }
    if (addComment) {
      ticket.comments.push({ text: addComment, postedBy: req.user.userId });
    }

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a ticket
// @route   DELETE /api/tickets/:id
// @access  Admin only
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Not found' });
    
    if (ticket.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await ticket.deleteOne();
    res.json({ message: 'Ticket removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};
