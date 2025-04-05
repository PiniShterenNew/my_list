import List from '../../../models/list.model';
import User, { IUser } from '../../../models/user.model';
import { clearDatabase } from '../../helpers/db.helper';
import mongoose from 'mongoose';

describe('List Model Tests', () => {
  let userId: string;
  jest.setTimeout(15000); // או אפילו 20000
  // לפני כל הבדיקות
  beforeEach(async () => {
    // נקה את מסד הנתונים
    
    await clearDatabase();
    
    // צור משתמש לבדיקות
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה'
    }) as mongoose.Document<unknown, {}, IUser> & IUser & { _id: mongoose.Types.ObjectId };
    
    userId = user._id.toString();
  });
  
  it('should create a list successfully', async () => {
    const listData = {
      name: 'רשימת בדיקה',
      description: 'תיאור רשימת בדיקה',
      type: 'oneTime',
      owner: userId,
      status: 'active',
      categoriesUsed: ['produce', 'dairy'],
      sharedWith: [],
      tags: ['test', 'shopping']
    };
    
    const list = await List.create(listData);
    
    // בדוק שהרשימה נוצרה בהצלחה
    expect(list).toBeDefined();
    expect(list.name).toBe(listData.name);
    expect(list.description).toBe(listData.description);
    expect(list.type).toBe(listData.type);
    expect(list.owner.toString()).toBe(userId.toString());
    expect(list.status).toBe(listData.status);
    expect(list.categoriesUsed).toEqual(listData.categoriesUsed);
    expect(list.tags).toEqual(listData.tags);
  });
  
  it('should set default values correctly', async () => {
    // צור רשימה עם מינימום שדות
    const list = await List.create({
      name: 'רשימה מינימלית',
      owner: userId
    });
    
    // בדוק ערכי ברירת מחדל
    expect(list.type).toBe('oneTime');
    expect(list.status).toBe('active');
    expect(list.categoriesUsed).toEqual([]);
    expect(list.sharedWith).toEqual([]);
    expect(list.history).toEqual([]);
    expect(list.tags).toEqual([]);
    
    // בדוק שתאריכים הוגדרו
    expect(list.createdAt).toBeDefined();
    expect(list.lastModified).toBeDefined();
  });
  
  it('should require name and owner fields', async () => {
    try {
      await List.create({});
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for missing required fields');
    } catch (error: any) {
      expect(error.errors.name).toBeDefined();
      expect(error.errors.owner).toBeDefined();
    }
  });
  
  it('should validate type enum values', async () => {
    try {
      await List.create({
        name: 'רשימת בדיקה',
        owner: userId,
        type: 'invalidType'
      });
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for invalid type');
    } catch (error: any) {
      expect(error.errors.type).toBeDefined();
    }
  });
  
  it('should validate status enum values', async () => {
    try {
      await List.create({
        name: 'רשימת בדיקה',
        owner: userId,
        status: 'invalidStatus'
      });
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for invalid status');
    } catch (error: any) {
      expect(error.errors.status).toBeDefined();
    }
  });
  
  it('should update lastModified on save', async () => {
    // צור רשימה
    const list = await List.create({
      name: 'רשימת בדיקה',
      owner: userId
    });
    
    // שמור את זמן השינוי המקורי
    const originalModified = new Date(list.lastModified);
    
    // המתן מעט לפני העדכון
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // עדכן את הרשימה
    list.name = 'שם חדש לרשימה';
    await list.save();
    
    // בדוק שזמן השינוי התעדכן
    expect(new Date(list.lastModified).getTime()).toBeGreaterThan(originalModified.getTime());
  });
  
  it('should not allow duplicate users in sharedWith', async () => {
    // צור משתמש נוסף
    const anotherUser = await User.create({
      email: 'other@example.com',
      passwordHash: 'password123',
      name: 'משתמש נוסף'
    });
    
    // נסה ליצור רשימה עם משתמש שמופיע פעמיים בsharedWith
    try {
      await List.create({
        name: 'רשימת בדיקה',
        owner: userId,
        sharedWith: [
          { userId: anotherUser._id, permissions: 'view' },
          { userId: anotherUser._id, permissions: 'edit' }
        ]
      });
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for duplicate user in sharedWith');
    } catch (error: any) {
      expect(error.message).toContain('משתמש לא יכול להופיע יותר מפעם אחת');
    }
  });
  
  it('should validate permissions enum in sharedWith', async () => {
    // צור משתמש נוסף
    const anotherUser = await User.create({
      email: 'other@example.com',
      passwordHash: 'password123',
      name: 'משתמש נוסף'
    });
    
    try {
      await List.create({
        name: 'רשימת בדיקה',
        owner: userId,
        sharedWith: [
          { userId: anotherUser._id, permissions: 'invalidPermission' }
        ]
      });
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for invalid permission');
    } catch (error: any) {
      expect(error.errors['sharedWith.0.permissions']).toBeDefined();
    }
  });
});