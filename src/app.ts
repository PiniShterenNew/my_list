const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
import { Request, Response, NextFunction } from 'express';

const morganMiddleware = require('./middlewares/morgan.middleware');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const listRoutes = require('./routes/list.routes');
const catalogRoutes = require('./routes/catalog.routes');
const notificationRoutes = require('./routes/notification.routes');

// Load environment variables - אם כבר נטענו, לא יטענו שוב
if (!process.env.NODE_ENV) {
  dotenv.config();
}

// Initialize express app
const app = express();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(morganMiddleware.default); // HTTP request logger

// Routes
app.use('/api/auth', authRoutes.default || authRoutes);
app.use('/api/users', userRoutes.default || userRoutes);
app.use('/api/lists', listRoutes.default || listRoutes);
app.use('/api/catalog', catalogRoutes.default || catalogRoutes);
app.use('/api/notifications', notificationRoutes.default || notificationRoutes);

// Basic route for testing
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'שרת רשימות קניות פועל! 🛒',
    version: '1.0.0',
    env: process.env.NODE_ENV,
  });
});

// Handle errors
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'שגיאת שרת',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export { app };