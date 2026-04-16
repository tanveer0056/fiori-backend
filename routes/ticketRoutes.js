const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { getTickets, createTicket, updateTicket } = ticketController;
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getTickets)
  .post(protect, adminOnly, createTicket);

router.route('/:id')
  .put(protect, updateTicket)
  .delete(protect, adminOnly, ticketController.deleteTicket);

module.exports = router;
