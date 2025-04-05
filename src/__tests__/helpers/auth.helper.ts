import request from 'supertest';
import mongoose from 'mongoose';
import User from '../../models/user.model';
import { createTestUser } from './db.helper';
import { app } from '../../app';
import jwt from 'jsonwebtoken';

/**
 * צור טוקן JWT ישירות למשתמש
 */
export const generateToken = (userId: string): string => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET as string,
    { expiresIn: '15m' }
  );
};

/**
 * צור משתמש בדיקה וטוקן, החזר את הפרטים
 */
export const createAndAuthTestUser = async (
  overrides: Partial<any> = {}
) => {
  // צור משתמש חדש
  const { user, password } = await createTestUser(overrides);
  
  // צור טוקן ישירות בלי להשתמש ב-login
  const token = generateToken(user._id);
  
  return {
    user,
    token,
    password
  };
};

/**
 * החזר כותרות אוטוריזציה עם טוקן
 */
export const getAuthHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

/**
 * נקה את כל המשתמשים במערכת
 */
export const clearUsers = async () => {
  await User.deleteMany({});
};