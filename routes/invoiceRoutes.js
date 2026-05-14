const express = require('express');
const router = express.Router();
const { getInvoices, createInvoice, updateInvoice, deleteInvoice, getInvoiceSummary } = require('../controllers/invoiceController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/stage-summary', protect, getInvoiceSummary);

router.route('/')
  .get(protect, getInvoices)
  .post(protect, createInvoice);

router.route('/:id')
  .put(protect, adminOnly, updateInvoice)
  .delete(protect, adminOnly, deleteInvoice);

module.exports = router;
