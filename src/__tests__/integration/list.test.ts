import request from 'supertest';
import { app } from '../../app';
import User from '../../models/user.model';
import { generateToken, getAuthHeaders } from '../helpers/auth.helper';
import List from '../../models/list.model';
import { clearDatabase, createTestUser, createTestList } from '../helpers/db.helper';
import mongoose from 'mongoose';

describe('List Controller Tests', () => {
  let token: string;
  let userId: string;
  
  beforeEach(async () => {
    // נקה את מסד הנתונים לפני כל בדיקה
    await clearDatabase();
    
    // צור משתמש וקבל טוקן
    const { user, password } = await createTestUser();
    userId = user._id;
    
    // השתמש בפונקציה לייצור טוקן ישירות
    token = generateToken(userId);
  });
  
  describe('GET /api/lists', () => {
    it('should return empty array when no lists exist', async () => {
      const response = await request(app)
        .get('/api/lists')
        .set(getAuthHeaders(token));
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(0);
    });
    
    it('should return user\'s lists', async () => {
      // צור רשימות
      await createTestList(userId, { name: 'רשימה 1' });
      await createTestList(userId, { name: 'רשימה 2' });
      
      // צור רשימה של משתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      await createTestList(otherUser.user._id, { name: 'רשימה של משתמש אחר' });
      
      const response = await request(app)
        .get('/api/lists')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      const names = response.body.data.map((l: any) => l.name);
      expect(names).toContain('רשימה 1');
      expect(names).toContain('רשימה 2');
      
      const list1 = response.body.data.find((l: any) => l.name === 'רשימה 1');
      expect(names).toEqual(expect.arrayContaining(['רשימה 1', 'רשימה 2']));
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/lists');
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/lists', () => {
    it('should create a new list', async () => {
      const listData = {
        name: 'רשימת קניות לסופ"ש',
        description: 'קניות לשבת',
        type: 'oneTime',
        tags: ['סופ"ש', 'בית']
      };
      
      const response = await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${token}`)
        .send(listData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(listData.name);
      expect(response.body.data.description).toBe(listData.description);
      expect(response.body.data.type).toBe(listData.type);
      expect(response.body.data.tags).toEqual(listData.tags);
      
      // בדוק שהרשימה נשמרה במסד הנתונים
      const list = await List.findById(response.body.data._id);
      expect(list).toBeTruthy();
      expect(list!.name).toBe(listData.name);
    });
    
    it('should require name field', async () => {
      const response = await request(app)
        .post('/api/lists')
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'רשימה ללא שם'
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(500); // mongoose validation error
      expect(response.body.success).toBe(false);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/lists')
        .send({
          name: 'רשימה ללא אימות'
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/lists/:id', () => {
    let listId: string;
    
    beforeEach(async () => {
      // צור רשימה לבדיקות
      const list = await createTestList(userId, {
        name: 'רשימה לפרטים',
        description: 'רשימה לבדיקת קבלת פרטים'
      });
      
      listId = list._id;
    });
    
    it('should get a specific list by ID', async () => {
      const response = await request(app)
        .get(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id).toBe(listId);
      expect(response.body.data.name).toBe('רשימה לפרטים');
      expect(response.body.data.description).toBe('רשימה לבדיקת קבלת פרטים');
    });
    
    it('should not get a list that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/lists/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
    
    it('should not get a list that belongs to another user', async () => {
      // צור משתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      
      // צור רשימה למשתמש האחר
      const otherList = await createTestList(otherUser.user._id, {
        name: 'רשימה של משתמש אחר'
      });
      
      const response = await request(app)
        .get(`/api/lists/${otherList._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אין לך הרשאה');
    });
  });
  
  describe('PUT /api/lists/:id', () => {
    let listId: string;
    
    beforeEach(async () => {
      // צור רשימה לבדיקות
      const list = await createTestList(userId, {
        name: 'רשימה לעדכון',
        description: 'רשימה לבדיקת עדכון'
      });
      
      listId = list._id;
    });
    
    it('should update a list', async () => {
      const updateData = {
        name: 'שם מעודכן',
        description: 'תיאור מעודכן',
        tags: ['מעודכן', 'חדש']
      };
      
      const response = await request(app)
        .put(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.tags).toEqual(updateData.tags);
      
      // בדוק שהרשימה התעדכנה במסד הנתונים
      const updatedList = await List.findById(listId);
      expect(updatedList!.name).toBe(updateData.name);
      expect(updatedList!.description).toBe(updateData.description);
    });
    
    it('should not update a list that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/lists/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'שם חדש' });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
    
    it('should not update a list that belongs to another user', async () => {
      // צור משתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      
      // צור רשימה למשתמש האחר
      const otherList = await createTestList(otherUser.user._id, {
        name: 'רשימה של משתמש אחר'
      });
      
      const response = await request(app)
        .put(`/api/lists/${otherList._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'שם חדש' });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אין לך הרשאה');
    });
  });
  
  describe('DELETE /api/lists/:id', () => {
    let listId: string;
    
    beforeEach(async () => {
      // צור רשימה לבדיקות
      const list = await createTestList(userId, {
        name: 'רשימה למחיקה'
      });
      
      listId = list._id;
    });
    
    it('should delete a list', async () => {
      const response = await request(app)
        .delete(`/api/lists/${listId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('נמחקה בהצלחה');
      
      // בדוק שהרשימה נמחקה ממסד הנתונים
      const deletedList = await List.findById(listId);
      expect(deletedList).toBeNull();
    });
    
    it('should not delete a list that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/lists/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
    
    it('should not delete a list that belongs to another user', async () => {
      // צור משתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      
      // צור רשימה למשתמש האחר
      const otherList = await createTestList(otherUser.user._id, {
        name: 'רשימה של משתמש אחר'
      });
      
      const response = await request(app)
        .delete(`/api/lists/${otherList._id}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אין לך הרשאה');
    });
  });
  
  describe('PUT /api/lists/:id/status', () => {
    let listId: string;
    
    beforeEach(async () => {
      // צור רשימה לבדיקות
      const list = await createTestList(userId, {
        name: 'רשימה לשינוי סטטוס',
        status: 'active'
      });
      
      listId = list._id;
    });
    
    it('should update list status', async () => {
      const response = await request(app)
        .put(`/api/lists/${listId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'shopping' });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('shopping');
      
      // בדוק שהסטטוס התעדכן במסד הנתונים
      const updatedList = await List.findById(listId);
      expect(updatedList!.status).toBe('shopping');
    });
    
    it('should validate status values', async () => {
      const response = await request(app)
        .put(`/api/lists/${listId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'invalid_status' });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('סטטוס תקף');
    });
  });
  
  describe('GET /api/lists/shared', () => {
    it('should get lists shared with the user', async () => {
      // צור משתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      const otherUserId = otherUser.user._id;
      
      // צור רשימה שתשותף עם המשתמש הנוכחי
      const sharedList = await createTestList(otherUserId, {
        name: 'רשימה משותפת',
        sharedWith: [
          {
            userId: userId,
            permissions: 'edit',
            joinedAt: new Date()
          }
        ]
      });
      
      // צור עוד רשימה לא משותפת
      await createTestList(otherUserId, {
        name: 'רשימה לא משותפת'
      });
      
      const response = await request(app)
        .get('/api/lists/shared')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]._id).toBe(sharedList._id);
      expect(response.body.data[0].name).toBe('רשימה משותפת');
    });
  });
  
  describe('POST /api/lists/:id/share', () => {
    let listId: string;
    let otherUserId: string;
    
    beforeEach(async () => {
      // צור רשימה לבדיקות
      const list = await createTestList(userId, {
        name: 'רשימה לשיתוף'
      });
      
      listId = list._id;
      
      // צור משתמש נוסף לשיתוף
      const otherUser = await createTestUser({ email: 'other@example.com' });
      otherUserId = otherUser.user._id;
    });
    
    it('should share a list with another user', async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          users: [
            {
              userId: otherUserId.toString(),
              permissions: 'view'
            }
          ]
        });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.sharedWith).toHaveLength(1);
      expect(response.body.data.sharedWith[0].userId).toBe(otherUserId);
      expect(response.body.data.sharedWith[0].permissions).toBe('view');
      
      // בדוק שהשיתוף נשמר במסד הנתונים
      const updatedList = await List.findById(listId);
      expect(updatedList!.sharedWith).toHaveLength(1);
      expect(updatedList!.sharedWith[0].userId.toString()).toBe(otherUserId);
    });
    
    it('should require an array of users to share with', async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/share`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('רשימת משתמשים');
    });
  });
});