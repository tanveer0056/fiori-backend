const express = require('express');
const router = express.Router();
const { getInvoices, createInvoice, updateInvoice, deleteInvoice } = require('../controllers/invoiceController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.route('/')
  .get(protect, getInvoices)
  .post(protect, adminOnly, createInvoice);

router.route('/:id')
  .put(protect, adminOnly, updateInvoice)
  .delete(protect, adminOnly, deleteInvoice);

module.exports = router;
