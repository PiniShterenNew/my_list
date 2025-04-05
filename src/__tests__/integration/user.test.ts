import request from 'supertest';
import { app } from '../../app';
import User from '../../models/user.model';
import { clearDatabase, createTestUser } from '../helpers/db.helper';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { generateToken } from '../helpers/auth.helper';

describe('User Controller Tests', () => {
  let token: string;
  let userId: string;
  
  beforeEach(async () => {
    // נקה את מסד הנתונים לפני כל בדיקה
    await clearDatabase();
    
    // צור משתמש וקבל את מזהה המשתמש
    const { user, password } = await createTestUser();
    userId = user._id;
    
    // השתמש בפונקציה לייצור טוקן
    token = generateToken(userId);
  });
  
  describe('GET /api/users/me', () => {
    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(userId.toString());
      expect(response.body.data.email).toBeDefined();
      expect(response.body.data.name).toBeDefined();
    });
    
    it('should not access profile without token', async () => {
      const response = await request(app)
        .get('/api/users/me');
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/users/me', () => {
    it('should update user profile', async () => {
      const updateData = {
        name: 'שם מעודכן',
        avatar: 'https://example.com/new-avatar.jpg'
      };
      
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.avatar).toBe(updateData.avatar);
      
      // בדוק שהמשתמש התעדכן במסד הנתונים
      const updatedUser = await User.findById(userId);
      expect(updatedUser!.name).toBe(updateData.name);
      expect(updatedUser!.avatar).toBe(updateData.avatar);
    });
  });
  
  describe('PUT /api/users/me/preferences', () => {
    it('should update user preferences', async () => {
      const updateData = {
        preferences: {
          language: 'en',
          theme: 'dark',
          shoppingMode: {
            hideCheckedItems: false,
            sortBy: 'name'
          }
        }
      };
      
      const response = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.language).toBe(updateData.preferences.language);
      expect(response.body.data.theme).toBe(updateData.preferences.theme);
      expect(response.body.data.shoppingMode.hideCheckedItems).toBe(updateData.preferences.shoppingMode.hideCheckedItems);
      expect(response.body.data.shoppingMode.sortBy).toBe(updateData.preferences.shoppingMode.sortBy);
      
      // בדוק שההעדפות התעדכנו במסד הנתונים
      const updatedUser = await User.findById(userId);
      expect(updatedUser!.preferences.language).toBe(updateData.preferences.language);
      expect(updatedUser!.preferences.theme).toBe(updateData.preferences.theme);
    });
    
    it('should require preferences object', async () => {
      const response = await request(app)
        .put('/api/users/me/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא סופקו העדפות');
    });
  });
  
  describe('GET /api/users/search', () => {
    beforeEach(async () => {
      // צור עוד כמה משתמשים לחיפוש
      await createTestUser({
        email: 'john@example.com',
        name: 'ג\'ון דו'
      });
      
      await createTestUser({
        email: 'jane@example.com',
        name: 'ג\'יין דו'
      });
      
      await createTestUser({
        email: 'test@domain.com',
        name: 'משתמש בדיקה'
      });
    });
    
    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/users/search?q=ג\'יין')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // בדוק שהמשתמש המבוקש נמצא
      const foundUser = response.body.data.find((u: any) => u.name === 'ג\'יין דו');
      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe('jane@example.com');
    });
    
    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/users/search?q=test@domain')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // בדוק שהמשתמש המבוקש נמצא
      const foundUser = response.body.data.find((u: any) => u.email === 'test@domain.com');
      expect(foundUser).toBeDefined();
      expect(foundUser.name).toBe('משתמש בדיקה');
    });
    
    it('should not include the current user in search results', async () => {
      // מצא את האימייל של המשתמש הנוכחי
      const currentUser = await User.findById(userId);
      
      // חפש לפי האימייל של המשתמש הנוכחי
      const response = await request(app)
        .get(`/api/users/search?q=${currentUser!.email}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק שהמשתמש הנוכחי לא כלול בתוצאות
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const foundCurrentUser = response.body.data.find(
        (u: any) => u._id.toString() === userId.toString()
      );
      expect(foundCurrentUser).toBeUndefined();
    });
    
    it('should require search query', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('מחרוזת חיפוש');
    });
  });
  
  describe('GET /api/users/contacts', () => {
    let contactId: string;
    
    beforeEach(async () => {
      // צור משתמש לאנשי קשר
      const contactUser = await createTestUser({
        email: 'contact@example.com',
        name: 'איש קשר'
      });
      
      contactId = contactUser.user._id;
      
      // הוסף את המשתמש לאנשי הקשר של המשתמש הנוכחי
      await User.findByIdAndUpdate(userId, {
        $push: { contacts: contactId }
      });
    });
    
    it('should get user contacts', async () => {
      const response = await request(app)
        .get('/api/users/contacts')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0]._id.toString()).toBe(contactId.toString());
      expect(response.body.data[0].name).toBe('איש קשר');
      expect(response.body.data[0].email).toBe('contact@example.com');
    });
  });
  
  describe('POST /api/users/contacts', () => {
    let newContactId: string;
    
    beforeEach(async () => {
      // צור משתמש חדש להוספה לאנשי קשר
      const newContact = await createTestUser({
        email: 'newcontact@example.com',
        name: 'איש קשר חדש'
      });
      
      newContactId = newContact.user._id;
    });
    
    it('should add a contact', async () => {
      const response = await request(app)
        .post('/api/users/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: newContactId.toString() });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(newContactId.toString());
      expect(response.body.data.name).toBe('איש קשר חדש');
      
      // בדוק שאיש הקשר נוסף לרשימת אנשי הקשר
      const updatedUser = await User.findById(userId);
      const contactExists = updatedUser!.contacts.some(
        contactId => contactId.toString() === newContactId.toString()
      );
      expect(contactExists).toBe(true);
    });
    
    it('should not add yourself as a contact', async () => {
      const response = await request(app)
        .post('/api/users/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: userId.toString() });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('להוסיף את עצמך');
    });
    
    it('should not add a contact that doesn\'t exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post('/api/users/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: fakeId.toString() });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצא');
    });
    
    it('should not add a contact twice', async () => {
      // הוסף את איש הקשר פעם ראשונה
      await request(app)
        .post('/api/users/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: newContactId.toString() });
      
      // נסה להוסיף שוב
      const response = await request(app)
        .post('/api/users/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: newContactId.toString() });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('כבר נמצא');
    });
  });
  
  describe('DELETE /api/users/contacts/:id', () => {
    let contactId: string;
    
    beforeEach(async () => {
      // צור משתמש לאנשי קשר
      const contactUser = await createTestUser({
        email: 'contact@example.com',
        name: 'איש קשר'
      });
      
      contactId = contactUser.user._id;
      
      // הוסף את המשתמש לאנשי הקשר של המשתמש הנוכחי
      await User.findByIdAndUpdate(userId, {
        $push: { contacts: contactId }
      });
    });
    
    it('should remove a contact', async () => {
      const response = await request(app)
        .delete(`/api/users/contacts/${contactId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('הוסר בהצלחה');
      
      // בדוק שאיש הקשר הוסר מרשימת אנשי הקשר
      const updatedUser = await User.findById(userId);
      const contactExists = updatedUser!.contacts.some(
        id => id.toString() === contactId.toString()
      );
      expect(contactExists).toBe(false);
    });
    
    it('should not remove a contact that is not in the list', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/users/contacts/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('אינו ברשימת');
    });
  });
});