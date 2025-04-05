import request from 'supertest';
import { app } from '../../app';
import User from '../../models/user.model';
import List from '../../models/list.model';
import ListItem from '../../models/listItem.model';
import { clearDatabase, createTestUser, createTestList, createTestListItem, createTestCategories } from '../helpers/db.helper';
import mongoose from 'mongoose';
import { generateToken } from '../helpers/auth.helper';

describe('List Item Controller Tests', () => {
  let token: string;
  let userId: string;
  let listId: string;
  
  beforeEach(async () => {
    // נקה את מסד הנתונים לפני כל בדיקה
    await clearDatabase();
    
    // צור קטגוריות בסיסיות
    await createTestCategories();
    
    // צור משתמש וקבל טוקן
    const { user, password } = await createTestUser();
    userId = user._id;
    
    // השתמש בפונקציה לייצור טוקן ישירות
    token = generateToken(userId);
    
    // צור רשימה לבדיקות
    const list = await createTestList(userId, {
      name: 'רשימה לבדיקת פריטים'
    });
    
    listId = list._id;
  });
  
  describe('GET /api/lists/:id/items', () => {
    it('should return empty array when no items exist', async () => {
      const response = await request(app)
        .get(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data).toHaveLength(0);
    });
    
    it('should return list items', async () => {
      // צור פריטים ברשימה
      await createTestListItem(listId, userId, { name: 'פריט 1' });
      await createTestListItem(listId, userId, { name: 'פריט 2' });
      
      const response = await request(app)
        .get(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].name).toBe('פריט 1');
      expect(response.body.data[1].name).toBe('פריט 2');
    });
    
    it('should not access items from a list that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/lists/${fakeId}/items`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
    
    it('should not access items from a list that belongs to another user', async () => {
      // צור משתמש אחר
      const otherUser = await createTestUser({ email: 'other@example.com' });
      
      // צור רשימה למשתמש האחר
      const otherList = await createTestList(otherUser.user._id, {
        name: 'רשימה של משתמש אחר'
      });
      
      const response = await request(app)
        .get(`/api/lists/${otherList._id}/items`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אין לך הרשאה');
    });
  });
  
  describe('POST /api/lists/:id/items', () => {
    it('should add a new item to the list', async () => {
      const itemData = {
        name: 'חלב',
        category: {
          main: 'dairy',
          sub: 'milk'
        },
        quantity: 2,
        unit: 'קרטון',
        isPermanent: true
      };
      
      const response = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send(itemData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(itemData.name);
      expect(response.body.data.category.main).toBe(itemData.category.main);
      expect(response.body.data.quantity).toBe(itemData.quantity);
      expect(response.body.data.unit).toBe(itemData.unit);
      expect(response.body.data.isPermanent).toBe(itemData.isPermanent);
      expect(response.body.data.listId).toBe(listId);
      expect(response.body.data.addedBy).toBeDefined();
      
      // בדוק שהפריט נשמר במסד הנתונים
      const item = await ListItem.findById(response.body.data._id);
      expect(item).toBeTruthy();
      expect(item!.name).toBe(itemData.name);
      
      // בדוק שהקטגוריה התווספה לרשימת הקטגוריות ברשימה
      const updatedList = await List.findById(listId);
      expect(updatedList!.categoriesUsed).toContain(itemData.category.main);
    });
    
    it('should require a name', async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: {
            main: 'dairy'
          },
          quantity: 1
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(500); // mongoose validation error
      expect(response.body.success).toBe(false);
    });
    
    it('should require a main category', async () => {
      const response = await request(app)
        .post(`/api/lists/${listId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'פריט ללא קטגוריה',
          quantity: 1
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('קטגוריה ראשית');
    });
  });
  
  describe('PUT /api/lists/:id/items/:itemId', () => {
    let itemId: string;
    
    beforeEach(async () => {
      // צור פריט לבדיקות
      const item = await createTestListItem(listId, userId, {
        name: 'פריט לעדכון',
        category: {
          main: 'produce',
          sub: 'vegetables'
        },
        quantity: 1,
        unit: 'יח\'',
        isPermanent: false
      });
      
      itemId = item._id;
    });
    
    it('should update an item', async () => {
      const updateData = {
        name: 'שם מעודכן',
        quantity: 3,
        unit: 'ק"ג',
        isPermanent: true
      };
      
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.quantity).toBe(updateData.quantity);
      expect(response.body.data.unit).toBe(updateData.unit);
      expect(response.body.data.isPermanent).toBe(updateData.isPermanent);
      
      // בדוק שהפריט התעדכן במסד הנתונים
      const updatedItem = await ListItem.findById(itemId);
      expect(updatedItem!.name).toBe(updateData.name);
      expect(updatedItem!.quantity).toBe(updateData.quantity);
    });
    
    it('should not update an item that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${fakeId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'שם חדש' });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצא');
    });
    
    it('should update the category in the list\'s categoriesUsed', async () => {
      // וודא שהקטגוריה החדשה לא נמצאת ברשימת הקטגוריות
      const list = await List.findById(listId);
      expect(list!.categoriesUsed).not.toContain('dairy');
      
      // עדכן את הפריט עם קטגוריה חדשה
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          category: {
            main: 'dairy',
            sub: 'milk'
          }
        });
      
      // בדוק שהקטגוריה התווספה לרשימת הקטגוריות
      const updatedList = await List.findById(listId);
      expect(updatedList!.categoriesUsed).toContain('dairy');
    });
  });
  
  describe('DELETE /api/lists/:id/items/:itemId', () => {
    let itemId: string;
    
    beforeEach(async () => {
      // צור פריט לבדיקות
      const item = await createTestListItem(listId, userId, {
        name: 'פריט למחיקה'
      });
      
      itemId = item._id;
    });
    
    it('should delete an item', async () => {
      const response = await request(app)
        .delete(`/api/lists/${listId}/items/${itemId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('נמחק בהצלחה');
      
      // בדוק שהפריט נמחק ממסד הנתונים
      const deletedItem = await ListItem.findById(itemId);
      expect(deletedItem).toBeNull();
    });
    
    it('should not delete an item that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/lists/${listId}/items/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצא');
    });
  });
  
  describe('PUT /api/lists/:id/items/:itemId/check', () => {
    let itemId: string;
    
    beforeEach(async () => {
      // צור פריט לבדיקות
      const item = await createTestListItem(listId, userId, {
        name: 'פריט לסימון',
        isChecked: false
      });
      
      itemId = item._id;
    });
    
    it('should toggle item checked status to false', async () => {
      // קודם סמן את הפריט כנרכש
      await ListItem.findByIdAndUpdate(itemId, {
        isChecked: true,
        checkedAt: new Date()
      });
  
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}/check`) // ← שים לב גם לזה!
        .set('Authorization', `Bearer ${token}`)
        .send({ isChecked: false });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.isChecked).toBe(true);
      expect(response.body.data.checkedAt).toBeDefined();
      
      // בדוק שהפריט התעדכן במסד הנתונים
      const updatedItem = await ListItem.findById(itemId);
      expect(updatedItem!.isChecked).toBe(true);
      expect(updatedItem!.checkedAt).toBeDefined();
    });
    
    it('should toggle item checked status to false', async () => {
      // קודם סמן את הפריט כנרכש
      await ListItem.findByIdAndUpdate(itemId, {
        isChecked: true,
        checkedAt: new Date()
      });
      
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}/check`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isChecked: false });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.isChecked).toBe(false);
      expect(response.body.data.checkedAt).toBeUndefined();
    });
    
    it('should toggle item checked status without providing value', async () => {
      // בדוק שהפריט לא מסומן בהתחלה
      const initialItem = await ListItem.findById(itemId);
      expect(initialItem!.isChecked).toBe(false);
      
      // שלח בקשה ללא ערך isChecked
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}/check`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      // בדוק שהערך התהפך לtrue
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isChecked).toBe(true);
      
      // שלח בקשה נוספת ללא ערך
      const response2 = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}/check`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      // בדוק שהערך התהפך לfalse
      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
      expect(response2.body.data.isChecked).toBe(false);
    });
    
    it('should allow checking items with view-only permissions', async () => {
      // צור משתמש נוסף
      const otherUser = await createTestUser({ email: 'viewer@example.com' });
      const otherUserLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: otherUser.user.email,
          password: otherUser.password
        });
      
      const viewerToken = otherUserLoginResponse.body.accessToken;
      
      // שתף את הרשימה עם המשתמש החדש בהרשאות צפייה בלבד
      await List.findByIdAndUpdate(listId, {
        $push: {
          sharedWith: {
            userId: otherUser.user._id,
            permissions: 'view',
            joinedAt: new Date()
          }
        }
      });
      
      // נסה לסמן פריט עם משתמש בעל הרשאות צפייה בלבד
      const response = await request(app)
        .put(`/api/lists/${listId}/items/${itemId}/check`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ isChecked: true });
      
      // בדוק שהפעולה הצליחה
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isChecked).toBe(true);
    });
  });
  
  describe('POST /api/lists/:id/complete', () => {
    beforeEach(async () => {
      // צור פריטים לבדיקות
      await createTestListItem(listId, userId, {
        name: 'פריט 1',
        isChecked: true,
        checkedAt: new Date()
      });
      
      await createTestListItem(listId, userId, {
        name: 'פריט 2',
        isChecked: false
      });
      
      await createTestListItem(listId, userId, {
        name: 'פריט 3',
        isChecked: true,
        checkedAt: new Date()
      });
    });
    
    it('should complete shopping for one-time list', async () => {
      // וודא שהרשימה היא חד-פעמית
      await List.findByIdAndUpdate(listId, { type: 'oneTime' });
      
      const response = await request(app)
        .post(`/api/lists/${listId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('הושלם בהצלחה');
      expect(response.body.data.type).toBe('oneTime');
      
      // בדוק שסטטוס הרשימה התעדכן
      const updatedList = await List.findById(listId);
      expect(updatedList!.status).toBe('completed');
      
      // בדוק שהפריטים נשארו כמו שהם
      const items = await ListItem.find({ listId });
      const checkedItems = items.filter(item => item.isChecked);
      expect(checkedItems).toHaveLength(2);
    });
    
    it('should complete shopping for permanent list and reset checked items', async () => {
      // הגדר את הרשימה כקבועה
      await List.findByIdAndUpdate(listId, { type: 'permanent' });
      
      const response = await request(app)
        .post(`/api/lists/${listId}/complete`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('הושלם בהצלחה');
      expect(response.body.data.type).toBe('permanent');
      
      // בדוק שסטטוס הרשימה התעדכן
      const updatedList = await List.findById(listId);
      expect(updatedList!.status).toBe('completed');
      
      // בדוק שכל הפריטים לא מסומנים
      const items = await ListItem.find({ listId });
      const checkedItems = items.filter(item => item.isChecked);
      expect(checkedItems).toHaveLength(0);
      
      // בדוק שתאריכי הרכישה נמחקו
      for (const item of items) {
        expect(item.checkedAt).toBeUndefined();
      }
    });
  });
});