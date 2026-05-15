const Ticket = require('../models/Ticket');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

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

    let dbQuery = Ticket.find(query)
        .populate('assignedVendorId', 'email vendorDetails')
        .populate('comments.postedBy', 'email role');

    if (req.query.sort === 'desc' || req.query.sort === 'raisedDate:desc') {
      dbQuery = dbQuery.sort({ createdAt: -1 });
    }

    if (req.query.limit) {
      dbQuery = dbQuery.limit(parseInt(req.query.limit, 10));
    }

    const tickets = await dbQuery.exec();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Get ticket summary for dashboard
// @route   GET /api/tickets/monthly-summary
// @access  Admin/Vendor
exports.getTicketSummary = async (req, res) => {
  try {
    let query = { organizationId: req.user.organizationId };
    if (req.user.role === 'Vendor') {
      query.assignedVendorId = req.user.userId;
    }

    const tickets = await Ticket.find(query);

    const openComplaints = tickets.filter(t => t.status === 'Open').length;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const resolvedMTD = tickets.filter(t => t.status === 'Closed' && t.resolvedAt && new Date(t.resolvedAt) >= startOfMonth).length;

    let totalResolutionDays = 0;
    let resolvedCount = 0;
    tickets.forEach(t => {
      if (t.status === 'Closed' && t.resolvedAt) {
        resolvedCount++;
        totalResolutionDays += (new Date(t.resolvedAt) - new Date(t.createdAt)) / (1000 * 60 * 60 * 24);
      }
    });
    const avgResolution = resolvedCount ? (totalResolutionDays / resolvedCount).toFixed(1) : 0;


    const monthlySummary = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('default', { month: 'short' });
      
      const count = tickets.filter(t => {
        const tDate = new Date(t.createdAt);
        return tDate.getFullYear() === d.getFullYear() && tDate.getMonth() === d.getMonth();
      }).length;

      monthlySummary.push({ name: monthName, complaints: count });
    }

    res.json({
      openComplaints,
      resolvedMTD,
      avgResolution,
      monthlySummary
    });
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
  if (req.user.role === 'General User' || req.user.role === 'Vendor') {
    return res.status(403).json({ message: 'Not authorized to create tickets' });
  }
  const { 
    title, description, customerAccountId, assignedVendorId, natureOfWork, 
    siteLocation, pocDetails, priority, category, subCategory, 
    requestedBy, contactNumber, onBehalfOf, dueDate, tags 
  } = req.body;

  if (!title || !description || !customerAccountId || !assignedVendorId) {
    return res.status(400).json({ message: 'Required fields missing: Title, Description, Customer Account ID, and Vendor are mandatory.' });
  }

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
      category: category || 'Service',
      subCategory,
      requestedBy,
      contactNumber,
      onBehalfOf,
      dueDate,
      tags: tags || [],
      organizationId: req.user.organizationId
    });
    
    // Generate notification for assigned vendor
    try {
      await createNotification(req, {
        recipient: assignedVendorId,
        sender: req.user.userId,
        type: 'task',
        title: `New Ticket Assigned: #${ticket.ticketNo}`,
        body: `Ticket #${ticket.ticketNo} (${title}) has been assigned to you.`,
        tag: 'Complaints',
        link: `/app/complaints/${ticket._id}`
      });
    } catch (notifyErr) {
      console.error('Notification failed for new ticket:', notifyErr);
    }

    console.log(`[Email Mock] Sending assignment email to vendor ID ${assignedVendorId} for ticket ${ticket._id}`);

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Ticket Creation Error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: Object.values(error.errors).map(val => val.message).join(', ') });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A conflict occurred with the ticket reference numbering. Please try again.' });
    }
    res.status(500).json({ message: 'Internal Server Error during ticket registry.' });
  }
};

// @desc    Update a ticket
// @route   PUT /api/tickets/:id
// @access  Admin/Vendor
exports.updateTicket = async (req, res) => {
  const { 
    status, addComment, category, subCategory, priority, 
    natureOfWork, siteLocation, pocDetails, requestedBy, 
    contactNumber, onBehalfOf, dueDate, tags, resolutionCategory 
  } = req.body;
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Not found' });

    if (ticket.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'General User') {
      return res.status(403).json({ message: 'General Users cannot modify tickets' });
    }

    if (req.user.role === 'Vendor') {
      if (ticket.assignedVendorId.toString() !== req.user.userId.toString()) {
        return res.status(401).json({ message: 'Not your ticket' });
      }
      
      if (status && status !== ticket.status) {
        const vendorUser = await require('../models/User').findById(req.user.userId);
        if (!vendorUser || !vendorUser.allowTicketModification) {
          return res.status(403).json({ message: 'Vendor not permitted to modify ticket status' });
        }
      }
    }

    const oldStatus = ticket.status;
    if (status) {
      ticket.status = status;
      if (status === 'Closed') {
        ticket.resolvedAt = Date.now();
        if (resolutionCategory) ticket.resolutionCategory = resolutionCategory;
      } else {
        ticket.resolvedAt = undefined;
      }
    }

    // Update other ERP fields if provided
    if (category) ticket.category = category;
    if (subCategory) ticket.subCategory = subCategory;
    if (priority) ticket.priority = priority;
    if (natureOfWork) ticket.natureOfWork = natureOfWork;
    if (siteLocation) ticket.siteLocation = siteLocation;
    if (pocDetails) ticket.pocDetails = pocDetails;
    if (requestedBy) ticket.requestedBy = requestedBy;
    if (contactNumber) ticket.contactNumber = contactNumber;
    if (onBehalfOf) ticket.onBehalfOf = onBehalfOf;
    if (dueDate) ticket.dueDate = dueDate;
    if (tags) ticket.tags = tags;

    if (addComment) {
      ticket.comments.push({ text: addComment, postedBy: req.user.userId });
    }

    await ticket.save();

    // Notification Logic after update
    if (status === 'Closed' && oldStatus !== 'Closed') {
      await createNotification(req, {
        recipient: ticket.assignedVendorId,
        sender: req.user.userId,
        type: 'success',
        title: `Ticket Resolved: #${ticket.ticketNo}`,
        body: `Ticket #${ticket.ticketNo} ("${ticket.title}") has been successfully closed.`,
        tag: 'Complaints',
        link: `/app/complaints/${ticket._id}`
      });
    }

    if (addComment) {
      // Notify the opposite party
      const recipient = req.user.role === 'Admin' ? ticket.assignedVendorId : (await require('../models/User').findOne({ role: 'Admin', organizationId: ticket.organizationId }))?._id;
      
      if (recipient) {
        await createNotification(req, {
          recipient,
          sender: req.user.userId,
          type: 'info',
          title: 'New Comment on Ticket',
          body: addComment,
          tag: 'Complaints',
          link: `/app/complaints/${ticket._id}`
        });

        // --- PRO FEATURE: Sync with Messenger ---
        try {
          const adminUser = await User.findOne({ role: 'Admin', organizationId: ticket.organizationId });
          const vendorUser = await User.findById(ticket.assignedVendorId);
          const ticketRef = ticket.ticketNo || ticket._id.toString().slice(-6).toUpperCase();
          
          let chat = await Chat.findOne({
            vendorId: ticket.assignedVendorId,
            organizationId: req.user.organizationId
          });

          if (!chat) {
            // Fallback to searching for any chat including these members
            chat = await Chat.findOne({
              members: { $all: [req.user.userId, recipient.toString()] }
            });
          }

          if (!chat) {
            chat = await Chat.create({
              name: `Ticket Support - ${ticketRef}`,
              members: [req.user.userId, recipient.toString()],
              isGroup: true,
              organizationId: req.user.organizationId,
              vendorId: ticket.assignedVendorId
            });
          }

          const mentionName = req.user.role === 'Admin' 
            ? `@${vendorUser?.vendorDetails?.name || vendorUser?.username || vendorUser?.email?.split('@')[0] || 'Vendor'}` 
            : `@${adminUser?.username || adminUser?.email?.split('@')[0] || 'Admin'}`;
          const syncMessage = `📌 *Ticket Ref: #${ticketRef}*\n${mentionName} ${addComment}`;

          const messageDoc = await Message.create({
            chatId: chat._id,
            sender: req.user.userId,
            text: syncMessage
          });

          chat.latestMessage = messageDoc._id;
          await chat.save();

          // Populate for real-time emission
          const populatedMessage = await Message.findById(messageDoc._id).populate('sender', 'username email role vendorDetails');
          
          let sName = populatedMessage.sender.username;
          if (populatedMessage.sender.role === 'Vendor') {
            sName = populatedMessage.sender.vendorDetails?.name || populatedMessage.sender.vendorDetails?.company || populatedMessage.sender.username;
          }

          const formattedMessage = {
            id: populatedMessage._id,
            chatId: populatedMessage.chatId,
            sender: 'them', // Standard for socket emission
            senderId: populatedMessage.sender._id.toString(),
            senderName: sName || populatedMessage.sender.email,
            text: populatedMessage.text,
            timestamp: populatedMessage.createdAt,
            isRead: false,
            readBy: populatedMessage.readBy || [],
            dateGroup: new Date(populatedMessage.createdAt).toLocaleDateString(),
            rawText: populatedMessage.text,
            isDeleted: false,
            isEdited: false
          };

          // Emit real-time socket event
          const io = req.app.get('io');
          if (io) {
            console.log(`[Sync] Emitting formatted sync message to chat members`);
            if (chat.members) {
              chat.members.forEach(memberId => {
                io.to(`user_${memberId.toString()}`).emit('receive_message', formattedMessage);
              });
            } else {
              // Fallback if members not populated/available
              io.to(`user_${recipient.toString()}`).emit('receive_message', formattedMessage);
              io.to(`user_${req.user.userId}`).emit('receive_message', formattedMessage);
            }
          }
        } catch (msgErr) {
          console.error('Messenger sync error:', msgErr);
        }
      }
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc    Delete a ticket
// @route   DELETE /api/tickets/:id
// @access  Admin only
exports.deleteTicket = async (req, res) => {
  if (req.user.role === 'General User' || req.user.role === 'Vendor') {
    return res.status(403).json({ message: 'Not authorized to delete tickets' });
  }
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
