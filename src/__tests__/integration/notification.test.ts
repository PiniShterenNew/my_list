import request from 'supertest';
import { app } from '../../app';
import Notification from '../../models/notification.model';
import { clearDatabase, createTestUser } from '../helpers/db.helper';
import mongoose from 'mongoose';

describe('Notification Controller Tests', () => {
  let token: string;
  let userId: mongoose.Types.ObjectId;
  
  beforeEach(async () => {
    // נקה את מסד הנתונים לפני כל בדיקה
    await clearDatabase();
    
    // צור משתמש וקבל טוקן
    const { user, password } = await createTestUser();
userId = new mongoose.Types.ObjectId(user._id);
    
    // התחבר לקבלת טוקן
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: password
      });
    
    token = loginResponse.body.accessToken;
  });
  
  describe('GET /api/notifications', () => {
    it('should return empty array when no notifications exist', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.unreadCount).toBe(0);
    });
    
    it('should return user\'s notifications', async () => {
      // צור התראות
      await Notification.create({
        userId: userId,
        type: 'system',
        message: 'התראה 1',
        timestamp: new Date(),
        read: false
      });
      
      await Notification.create({
        userId: userId,
        type: 'share',
        message: 'התראה 2',
        timestamp: new Date(),
        read: true
      });
      
      // צור התראה למשתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await Notification.create({
        userId: otherUser.user._id,
        type: 'system',
        message: 'התראה למשתמש אחר',
        timestamp: new Date(),
        read: false
      });
      
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.unreadCount).toBe(1);
      
      // בדוק שההתראות שייכות למשתמש הנכון
      for (const notification of response.body.data) {
        expect(notification.userId.toString()).toBe(userId.toString());
      }
    });
    
    it('should filter unread notifications', async () => {
      // צור התראות
      await Notification.create({
        userId: userId,
        type: 'system',
        message: 'התראה שלא נקראה',
        timestamp: new Date(),
        read: false
      });
      
      await Notification.create({
        userId: userId,
        type: 'share',
        message: 'התראה שנקראה',
        timestamp: new Date(),
        read: true
      });
      
      const response = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].message).toBe('התראה שלא נקראה');
      expect(response.body.data[0].read).toBe(false);
    });
    
    it('should support pagination', async () => {
      // צור הרבה התראות
      const notifications: Array<{
        userId: mongoose.Types.ObjectId;
        type: 'system' | 'share' | 'reminder';
        message: string;
        timestamp: Date;
        read: boolean;
      }> = [];
      
      for (let i = 0; i < 15; i++) {
        notifications.push({
          userId: userId,
          type: 'system',
          message: `התראה ${i}`,
          timestamp: new Date(Date.now() - i * 60000), // הפרש של דקה בין ההתראות
          read: i % 2 === 0 // חלק נקראו וחלק לא
        });
      }
      
      await Notification.insertMany(notifications);
      
      // בדוק עמוד ראשון עם 5 תוצאות
      const response1 = await request(app)
        .get('/api/notifications?limit=5&page=1')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response1.status).toBe(200);
      expect(response1.body.data).toHaveLength(5);
      expect(response1.body.pagination).toBeDefined();
      expect(response1.body.pagination.page).toBe(1);
      expect(response1.body.pagination.limit).toBe(5);
      expect(response1.body.unreadCount).toBe(8); // חצי מ-15 התראות (מעוגל כלפי מטה)
      
      // בדוק עמוד שני
      const response2 = await request(app)
        .get('/api/notifications?limit=5&page=2')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response2.status).toBe(200);
      expect(response2.body.data).toHaveLength(5);
      expect(response2.body.pagination.page).toBe(2);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/notifications');
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/notifications/:id/read', () => {
    let notificationId: mongoose.Types.ObjectId;
    
    beforeEach(async () => {
      // צור התראה לבדיקות
      const notification = await Notification.create({
        userId,
        type: 'system',
        message: 'התראה לבדיקת סימון כנקראה',
        timestamp: new Date(),
        read: false
      });
      
      notificationId = notification._id as mongoose.Types.ObjectId;
    });
    
    it('should mark a notification as read', async () => {
      const response = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.read).toBe(true);
      
      // בדוק שההתראה סומנה כנקראה במסד הנתונים
      const updatedNotification = await Notification.findById(notificationId);
      expect(updatedNotification!.read).toBe(true);
    });
    
    it('should not mark a notification that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/notifications/${fakeId}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
    
    it('should not mark a notification that belongs to another user', async () => {
      // צור משתמש אחר והתראה עבורו
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherNotification = await Notification.create({
        userId: otherUser.user._id,
        type: 'system',
        message: 'התראה למשתמש אחר',
        timestamp: new Date(),
        read: false
      });
      
      const response = await request(app)
        .put(`/api/notifications/${otherNotification._id}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אין לך הרשאה');
    });
  });
  
  describe('PUT /api/notifications/read-all', () => {
    beforeEach(async () => {
      // צור מספר התראות שלא נקראו
      await Notification.insertMany([
        {
          userId,
          type: 'system',
          message: 'התראה 1',
          timestamp: new Date(),
          read: false
        },
        {
          userId,
          type: 'share',
          message: 'התראה 2',
          timestamp: new Date(),
          read: false
        },
        {
          userId,
          type: 'reminder',
          message: 'התראה 3',
          timestamp: new Date(),
          read: false
        }
      ]);
      
      // צור התראה שכבר נקראה
      await Notification.create({
        userId,
        type: 'system',
        message: 'התראה שנקראה',
        timestamp: new Date(),
        read: true
      });
      
      // צור התראה למשתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await Notification.create({
        userId: otherUser.user._id,
        type: 'system',
        message: 'התראה למשתמש אחר',
        timestamp: new Date(),
        read: false
      });
    });
    
    it('should mark all user\'s notifications as read', async () => {
      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('התראות סומנו כנקראו');
      
      // בדוק שכל ההתראות של המשתמש סומנו כנקראות
      const notifications = await Notification.find({ userId });
      expect(notifications).toHaveLength(4);
      
      for (const notification of notifications) {
        expect(notification.read).toBe(true);
      }
      
      // וודא שההתראה של המשתמש האחר לא השתנתה
      const otherUserNotifications = await Notification.find({ userId: { $ne: userId } });
      expect(otherUserNotifications).toHaveLength(1);
      expect(otherUserNotifications[0].read).toBe(false);
    });
  });
  
  describe('DELETE /api/notifications/:id', () => {
    let notificationId: mongoose.Types.ObjectId;
    
    beforeEach(async () => {
      // צור התראה לבדיקות
      const notification = await Notification.create({
        userId,
        type: 'system',
        message: 'התראה למחיקה',
        timestamp: new Date(),
        read: false
      });
      
      notificationId = notification._id as mongoose.Types.ObjectId;
    });
    
    it('should delete a notification', async () => {
      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('נמחקה בהצלחה');
      
      // בדוק שההתראה נמחקה ממסד הנתונים
      const deletedNotification = await Notification.findById(notificationId);
      expect(deletedNotification).toBeNull();
    });
    
    it('should not delete a notification that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/notifications/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
    
    it('should not delete a notification that belongs to another user', async () => {
      // צור משתמש אחר והתראה עבורו
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherNotification = await Notification.create({
        userId: otherUser.user._id,
        type: 'system',
        message: 'התראה למשתמש אחר',
        timestamp: new Date(),
        read: false
      });
      
      const response = await request(app)
        .delete(`/api/notifications/${otherNotification._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אין לך הרשאה');
    });
  });
});