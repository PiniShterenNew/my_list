import express from 'express';
import * as authController from '../controllers/auth.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// נתיבים ציבוריים
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);

// נתיבים מוגנים
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);

export default router;