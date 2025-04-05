const http = require('http');
const { Server: SocketServer } = require('socket.io');
require("./types/express/index")
const { app } = require('./app');
const { connectDB } = require('./config/db');
const logger = require('./utils/logger');
const { initSocketService } = require('./services/socket.service');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new SocketServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

// Initialize Socket service
const socketService = initSocketService(io);

// Connect to MongoDB
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: unknown) => {
  console.error(`Unhandled Rejection: ${err instanceof Error ? err.message : String(err)}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: unknown) => {
  console.error(`Uncaught Exception: ${err instanceof Error ? err.message : String(err)}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});