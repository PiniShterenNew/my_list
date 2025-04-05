import express from 'express';
import * as notificationController from '../controllers/notification.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// כל הנתיבים מוגנים
router.use(protect);

// נתיבי התראות
router.get('/', notificationController.getUserNotifications);
router.put('/:id/read', notificationController.markNotificationRead);
router.put('/read-all', notificationController.markAllNotificationsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;