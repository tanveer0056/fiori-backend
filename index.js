const express = require('express'); // nodemon trigger 2
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const orgRoutes = require('./routes/orgRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/organization', orgRoutes);

// Basic Route for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.get('/', (req, res) => {
  res.send('Fiori Backend is live.');
});

// Configure MongoDB independently from app.listen to support Serverless cold-starts
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Only run explicit port binding locally. Vercel acts as its own listener
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001; 
  // ensure it uses 5001 if local to match frontend map
  app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
  });
}

// Crucial: Vercel requires the app itself to be exported 
module.exports = app;
