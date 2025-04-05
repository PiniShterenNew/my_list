import User from '../../../models/user.model';
import { clearDatabase } from '../../helpers/db.helper';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

jest.setTimeout(15000); // הגדל את הזמן המוקצב לבדיקות

describe('User Model Tests', () => {
  // נקה את מסד הנתונים לפני כל הבדיקות
  beforeEach(async () => {
    await clearDatabase();
  });

  it('should create a new user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      passwordHash: 'password123', // יוצפן ע"י middleware
      name: 'משתמש בדיקה',
      avatar: 'https://example.com/avatar.jpg',
      preferences: {
        language: 'he',
        theme: 'light',
        shoppingMode: {
          hideCheckedItems: true,
          sortBy: 'category'
        }
      }
    };

    const user = await User.create(userData);
    
    // בדוק שהמשתמש נוצר בהצלחה
    expect(user).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.passwordHash).not.toBe(userData.passwordHash); // וודא שהסיסמה הוצפנה
  });

  it('should hash the password before saving', async () => {
    const plainPassword = 'password123';
    
    const user = new User({
      email: 'test@example.com',
      passwordHash: plainPassword,
      name: 'משתמש בדיקה'
    });
    
    await user.save();
    
    // בדוק שהסיסמה הוצפנה
    expect(user.passwordHash).not.toBe(plainPassword);
    
    // בדוק שהסיסמה המוצפנת תואמת את הסיסמה המקורית
    const isMatch = await bcrypt.compare(plainPassword, user.passwordHash);
    expect(isMatch).toBe(true);
  });

  it('should update password hash when password is modified', async () => {
    // צור משתמש
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה'
    });
    
    // שמור את הסיסמה המוצפנת המקורית
    const originalHash = user.passwordHash;
    
    // עדכן את הסיסמה
    user.passwordHash = 'newpassword123';
    await user.save();
    
    // בדוק שהסיסמה המוצפנת השתנתה
    expect(user.passwordHash).not.toBe(originalHash);
  });

  it('should match password correctly', async () => {
    const plainPassword = 'password123';
    
    // צור משתמש
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: plainPassword,
      name: 'משתמש בדיקה'
    });
    
    // בדוק שהשוואת סיסמה עובדת נכון
    const isMatch = await user.matchPassword(plainPassword);
    expect(isMatch).toBe(true);
    
    // בדוק שסיסמה שגויה לא תואמת
    const isMatchWrong = await user.matchPassword('wrongpassword');
    expect(isMatchWrong).toBe(false);
  });

  it('should generate JWT token', async () => {
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה'
    });
    
    // בדוק שהפונקציה מחזירה טוקן
    const token = user.getSignedJwtToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // פורמט JWT
  });

  it('should generate and save refresh token', async () => {
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה'
    });
    
    // וודא שאין טוקנים לפני
    expect(user.refreshTokens).toHaveLength(0);
    
    // צור טוקן רענון
    const refreshToken = user.getRefreshToken();
    
    // שמור את המשתמש כדי שהטוקן יישמר (עכשיו הפונקציה לא שומרת אוטומטית)
    await user.save();
    
    // טען את המשתמש מחדש
    const updatedUser = await User.findById(user._id);
    
    // בדוק שהטוקן נשמר
    expect(updatedUser!.refreshTokens).toHaveLength(1);
    expect(updatedUser!.refreshTokens[0]).toBe(refreshToken);
  });

  it('should limit refresh tokens to 5', async () => {
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה',
    });
    
    // צור 6 טוקנים
    const tokens: string[] = [];
    for (let i = 0; i < 6; i++) {
      const token = user.getRefreshToken();
      tokens.push(token);
      await user.save();
    }
    
    // טען את המשתמש מחדש
    const updatedUser = await User.findById(user._id);
    
    // בדוק שיש רק 5 טוקנים
    expect(updatedUser!.refreshTokens).toHaveLength(5);
    
    // בדוק שהטוקן הראשון שנוצר אינו נמצא ברשימה (הוא הוסר)
    expect(updatedUser!.refreshTokens).not.toContain(tokens[0]);
    
    // בדוק שהטוקן האחרון שנוצר נמצא ברשימה
    expect(updatedUser!.refreshTokens).toContain(tokens[5]);
  });

  it('should validate email format', async () => {
    try {
      await User.create({
        email: 'invalid-email',
        passwordHash: 'password123',
        name: 'משתמש בדיקה'
      });
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for invalid email');
    } catch (error: any) {
      expect(error.errors.email).toBeDefined();
      expect(error.errors.email.message).toContain('כתובת אימייל תקינה');
    }
  });

  it('should require email, password and name', async () => {
    try {
      await User.create({});
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown validation error for missing required fields');
    } catch (error: any) {
      expect(error.errors.email).toBeDefined();
      expect(error.errors.passwordHash).toBeDefined();
      expect(error.errors.name).toBeDefined();
    }
  });

  it('should enforce unique emails', async () => {
    // צור משתמש עם אימייל
    await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה 1'
    });
    
    // נסה ליצור משתמש נוסף עם אותו אימייל
    try {
      await User.create({
        email: 'test@example.com',
        passwordHash: 'anotherpassword',
        name: 'משתמש בדיקה 2'
      });
      
      // אם הגענו לכאן, הבדיקה נכשלה
      fail('Should have thrown duplicate key error');
    } catch (error: any) {
      expect(error.code).toBe(11000); // קוד שגיאה של מפתח כפול ב-MongoDB
    }
  });

  it('should set default preferences if not provided', async () => {
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה'
    });
    
    // בדוק שהעדפות ברירת מחדל הוגדרו
    expect(user.preferences).toBeDefined();
    expect(user.preferences.language).toBe('he');
    expect(user.preferences.theme).toBe('light');
    expect(user.preferences.shoppingMode).toBeDefined();
    expect(user.preferences.shoppingMode.hideCheckedItems).toBe(true);
    expect(user.preferences.shoppingMode.sortBy).toBe('category');
  });

  it('should store createdAt date', async () => {
    const beforeCreate = new Date();
    
    const user = await User.create({
      email: 'test@example.com',
      passwordHash: 'password123',
      name: 'משתמש בדיקה'
    });
    
    const afterCreate = new Date();
    
    // בדוק שתאריך היצירה הוגדר ובטווח הנכון
    expect(user.createdAt).toBeDefined();
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(user.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });
});