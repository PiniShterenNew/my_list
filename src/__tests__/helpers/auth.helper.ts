import request from 'supertest';
import mongoose from 'mongoose';
import User from '../../models/user.model';
import { createTestUser } from './db.helper';

let app: any;
try {
  // ייבא את האפליקציה רק אם מריצים את מחוץ למודול
  // בטסטים אנחנו נזין את האפליקציה מבחוץ
  const { app: expressApp } = require('../../app');
  app = expressApp;
} catch (error) {
  // אין צורך לעשות דבר אם האפליקציה לא נטענה
}

/**
 * מרשם משתמש חדש ומחזיר את האסימון ומזהה המשתמש
 */
export const registerUser = async (
  userDetails: {
    email: string;
    password: string;
    name: string;
  }
) => {
  const response = await request(app)
    .post('/api/auth/register')
    .send(userDetails);
  
  return {
    token: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    userId: response.body.user.id,
  };
};

/**
 * מתחבר למשתמש קיים ומחזיר את האסימון ומזהה המשתמש
 */
export const loginUser = async (
  credentials: {
    email: string;
    password: string;
  }
) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send(credentials);
  
  return {
    token: response.body.accessToken,
    refreshToken: response.body.refreshToken,
    userId: response.body.user.id,
  };
};

/**
 * מייצר משתמש בדיקה ומחזיר את פרטי ההתחברות
 */
export const createAndLoginTestUser = async (
  overrides: Partial<any> = {}
) => {
  // צור משתמש חדש
  const { user, password } = await createTestUser(overrides);
  
  // התחבר עם המשתמש
  const { token, refreshToken } = await loginUser({
    email: user.email,
    password,
  });
  
  return {
    user,
    token,
    refreshToken,
  };
};

/**
 * מחזיר כותרות אוטוריזציה עם טוקן
 */
export const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * מנקה את כל המשתמשים במערכת
 */
export const clearUsers = async () => {
  await User.deleteMany({});
};

/**
 * ייצר משתמש מנהל וייצר משתמש רגיל לבדיקות
 */
export const setupUsersForTests = async () => {
  // נקה את כל המשתמשים הקיימים
  await clearUsers();
  
  // צור משתמש מנהל
  const adminData = await createTestUser({
    email: 'admin@example.com',
    name: 'מנהל מערכת',
    isAdmin: true,
  });
  
  // צור משתמש רגיל
  const userData = await createTestUser({
    email: 'user@example.com',
    name: 'משתמש רגיל',
  });
  
  return {
    admin: adminData.user,
    adminPassword: adminData.password,
    user: userData.user,
    userPassword: userData.password,
  };
};