import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

import morganMiddleware from './middlewares/morgan.middleware';

// Routes import
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import listRoutes from './routes/list.routes';
import catalogRoutes from './routes/catalog.routes';
import notificationRoutes from './routes/notification.routes';

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
app.use(morganMiddleware); // HTTP request logger

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/notifications', notificationRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'שרת רשימות קניות פועל! 🛒',
    version: '1.0.0',
    env: process.env.NODE_ENV,
  });
});

// Handle errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'שגיאת שרת',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export { app };