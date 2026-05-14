const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const { 
  getUnreadCount, 
  getConversations, 
  getMessages, 
  sendMessage, 
  editMessage, 
  deleteMessage,
  markAsRead
} = require('../controllers/messageController');

router.use(protect);

router.get('/conversations/unread-count', getUnreadCount);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getMessages);
router.post('/conversations/:id', sendMessage);
router.post('/conversations/:id/read', markAsRead);
router.put('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;
