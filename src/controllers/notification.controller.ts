import { Request, Response } from 'express';
import Notification from '../models/notification.model';
import logger from '../utils/logger';

// @desc    קבלת התראות למשתמש
// @route   GET /api/notifications
// @access  פרטי
export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const { limit = 20, page = 1, unreadOnly = false } = req.query;
    
    // בנה את תנאי החיפוש
    const searchConditions: any = {
      userId: req.user._id,
    };
    
    // אם צריך רק הודעות שלא נקראו
    if (unreadOnly === 'true') {
      searchConditions.read = false;
    }
    
    // חשב את הדילוג
    const skip = (Number(page) - 1) * Number(limit);
    
    // קבל את ההתראות
    const notifications = await Notification.find(searchConditions)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // קבל את מספר ההתראות הכולל
    const total = await Notification.countDocuments(searchConditions);
    
    // קבל את מספר ההתראות שלא נקראו
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });
    
    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      data: notifications,
    });
  } catch (error: any) {
    logger.error(`Get user notifications error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת התראות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    סימון התראה כנקראה
// @route   PUT /api/notifications/:id/read
// @access  פרטי
export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    
    // מצא את ההתראה
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'ההתראה לא נמצאה',
      });
    }
    
    // וודא שההתראה שייכת למשתמש הנוכחי
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'אין לך הרשאה לעדכן התראה זו',
      });
    }
    
    // עדכן את סטטוס הקריאה
    notification.read = true;
    await notification.save();
    
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    logger.error(`Mark notification read error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בסימון התראה כנקראה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    סימון כל ההתראות כנקראו
// @route   PUT /api/notifications/read-all
// @access  פרטי
export const markAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    // עדכן את כל ההתראות של המשתמש
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} התראות סומנו כנקראו`,
    });
  } catch (error: any) {
    logger.error(`Mark all notifications read error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בסימון כל ההתראות כנקראו',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    מחיקת התראה
// @route   DELETE /api/notifications/:id
// @access  פרטי
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const notificationId = req.params.id;
    
    // מצא את ההתראה
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'ההתראה לא נמצאה',
      });
    }
    
    // וודא שההתראה שייכת למשתמש הנוכחי
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'אין לך הרשאה למחוק התראה זו',
      });
    }
    
    // מחק את ההתראה
    await notification.deleteOne();
    
    res.status(200).json({
      success: true,
      message: 'ההתראה נמחקה בהצלחה',
    });
  } catch (error: any) {
    logger.error(`Delete notification error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה במחיקת התראה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};