const express = require('express'); // nodemon trigger 2
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set('io', io);

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('User connected to socket:', socket.id);

  socket.on('identify', (userId) => {
    if (userId) {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.join(`user_${userId}`);
      io.emit('users_online_update', Array.from(onlineUsers.keys()));
    }
  });

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`Socket ${socket.id} joined chat ${chatId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('users_online_update', Array.from(onlineUsers.keys()));
    }
  });
});

app.use(cors());
app.use(express.json());

// Synchronous DB Connection enforcement for Serverless environments
const connectDB = async (req, res, next) => {
  if (mongoose.connections[0].readyState) {
    return next();
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err);
    return res.status(500).json({ message: 'Database Connection Failed. Ensure MONGODB_URI is set securely.' });
  }
};

app.use(connectDB);

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const orgRoutes = require('./routes/orgRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const searchRoutes = require('./routes/searchRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/organization', orgRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);

// Basic Route for testing
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.get('/', (req, res) => {
  res.send('Fiori Backend is live.');
});

// Only run explicit port binding locally. Vercel acts as its own listener
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  // ensure it uses 5001 if local to match frontend map
  server.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT} with Socket.io`);
  });
}

// Crucial: Vercel requires the app itself to be exported 
module.exports = app;
