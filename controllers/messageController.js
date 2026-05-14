const Chat = require('../models/Chat');
const Message = require('../models/Message');

// @desc    Get user's conversations
// @route   GET /api/messages/conversations
exports.getConversations = async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user.userId })
      .populate('members', 'username email vendorDetails role')
      .populate('latestMessage')
      .sort({ updatedAt: -1 });

    const formattedChats = await Promise.all(chats.map(async chat => {
      const vendor = chat.members.find(m => m.role === 'Vendor');
      
      const unreadCount = await Message.countDocuments({
        chatId: chat._id,
        sender: { $ne: req.user.userId },
        readBy: { $ne: req.user.userId }
      });
      
      let status = 'offline';
      if (chat.name === 'Contoso Ltd' || chat.name === 'Fabrikam Inc' || chat.name === 'Wide World Importers') status = 'online';
      if (chat.name === 'Adventure Works') status = 'away';

      const lastMsg = chat.latestMessage;
      let lastMessageText = lastMsg ? lastMsg.text : '';
      if (lastMsg && lastMsg.isDeleted) lastMessageText = 'This message was deleted';

      return {
        id: chat._id,
        contactName: vendor?.vendorDetails?.company || vendor?.vendorDetails?.name || chat.name,
        department: chat.isGroup ? 'Group' : 'Direct',
        status: status,
        unreadCount,
        lastMessage: lastMessageText,
        lastMessageSender: lastMsg?.sender || null,
        lastMessageReadBy: lastMsg?.readBy || [],
        timestamp: chat.updatedAt,
        code: vendor?.vendorDetails?.code || null,
        category: vendor?.vendorDetails?.category || null,
        members: chat.members,
        memberIds: chat.members.map(m => m._id)
      };
    }));

    res.json(formattedChats);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/conversations/:id
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.id })
      .populate('sender', 'username email role vendorDetails')
      .sort({ createdAt: 1 });

    const formattedMessages = messages.map(msg => {
      const isMe = msg.sender._id.toString() === req.user.userId;
      let text = msg.text;
      if (msg.isDeleted) text = 'This message was deleted';
      else if (msg.isEdited) text = text + ' (edited)';

      let sName = msg.sender.username;
      if (msg.sender.role === 'Vendor') {
        sName = msg.sender.vendorDetails?.name || msg.sender.vendorDetails?.company || msg.sender.username;
      }

      return {
        id: msg._id,
        sender: isMe ? 'me' : 'them',
        senderId: msg.sender._id.toString(),
        senderName: sName || msg.sender.email,
        text,
        timestamp: msg.createdAt,
        isRead: msg.readBy.length > 0,
        readBy: msg.readBy,
        dateGroup: new Date(msg.createdAt).toLocaleDateString(),
        rawText: msg.text,
        isDeleted: msg.isDeleted,
        isEdited: msg.isEdited
      };
    });

    res.json(formattedMessages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Send a message
// @route   POST /api/messages/conversations/:id
exports.sendMessage = async (req, res) => {
  const { text } = req.body;
  const chatId = req.params.id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    const newMessage = await Message.create({
      chatId,
      sender: req.user.userId,
      text
    });

    chat.latestMessage = newMessage._id;
    await chat.save();

    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'username email role vendorDetails');

    let sName = populatedMessage.sender.username;
    if (populatedMessage.sender.role === 'Vendor') {
      sName = populatedMessage.sender.vendorDetails?.name || populatedMessage.sender.vendorDetails?.company || populatedMessage.sender.username;
    }

    const formattedMessage = {
      id: populatedMessage._id,
      chatId: populatedMessage.chatId,
      sender: 'them', // Will be overridden on frontend if 'me'
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

    // Emit socket event to personal rooms
    const io = req.app.get('io');
    if (io && chat.members) {
      chat.members.forEach(memberId => {
        io.to(`user_${memberId.toString()}`).emit('receive_message', formattedMessage);
      });
    }

    res.status(201).json(formattedMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:messageId
exports.editMessage = async (req, res) => {
  const { text } = req.body;
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to edit this message' });
    }

    message.text = text;
    message.isEdited = true;
    await message.save();

    // Emit socket event
    const io = req.app.get('io');
    const chat = await Chat.findById(message.chatId);
    if (io && chat) {
      chat.members.forEach(memberId => {
        io.to(`user_${memberId.toString()}`).emit('message_edited', { id: message._id, text, isEdited: true });
      });
    }

    res.json({ message: 'Message updated', id: message._id, text });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a message
// @route   DELETE /api/messages/:messageId
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (message.sender.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    await message.deleteOne();

    // Emit socket event
    const io = req.app.get('io');
    const chat = await Chat.findById(message.chatId);
    if (io && chat) {
      chat.members.forEach(memberId => {
        io.to(`user_${memberId.toString()}`).emit('message_deleted', message._id);
      });
    }

    res.json({ message: 'Message deleted', id: message._id });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUnreadCount = async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user.userId }).select('_id');
    const chatIds = chats.map(c => c._id);
    const count = await Message.countDocuments({
      chatId: { $in: chatIds },
      sender: { $ne: req.user.userId },
      readBy: { $ne: req.user.userId }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Mark chat messages as read
// @route   POST /api/messages/conversations/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const chatId = req.params.id;
    await Message.updateMany(
      { chatId, sender: { $ne: req.user.userId }, readBy: { $ne: req.user.userId } },
      { $addToSet: { readBy: req.user.userId } }
    );
    
    // Emit socket event to notify other members that messages were read
    const io = req.app.get('io');
    const chat = await Chat.findById(chatId);
    if (io && chat) {
      chat.members.forEach(memberId => {
        io.to(`user_${memberId.toString()}`).emit('message_read', { chatId, readBy: req.user.userId });
      });
    }
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
