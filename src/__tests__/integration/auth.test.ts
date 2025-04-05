import request from 'supertest';
import { app } from '../../app';
import User from '../../models/user.model';
import { clearDatabase } from '../helpers/db.helper';
import jwt from 'jsonwebtoken';

describe('Auth Controller Tests', () => {
  beforeEach(async () => {
    // נקה את מסד הנתונים לפני כל בדיקה
    await clearDatabase();
  });
  
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'משתמש בדיקה'
      };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.name).toBe(userData.name);
      
      // בדוק שהמשתמש נשמר במסד הנתונים
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user!.name).toBe(userData.name);
    });
    
    it('should not register a user with an existing email', async () => {
      // צור משתמש ראשון
      await User.create({
        email: 'test@example.com',
        passwordHash: 'existingpassword',
        name: 'משתמש קיים'
      });
      
      // נסה לרשום משתמש עם אותו אימייל
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'newpassword',
          name: 'משתמש חדש'
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('כתובת האימייל כבר קיימת');
    });
    
    it('should validate required fields', async () => {
      // נסה לרשום משתמש ללא שדות חובה
      const response = await request(app)
        .post('/api/auth/register')
        .send({});
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(500); // השגיאה תהיה 500 כי מתרחשת בשלב ולידציה של mongoose
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // צור משתמש לבדיקת התחברות
      const user = new User({
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'משתמש בדיקה'
      });
      
      await user.save();
    });
    
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      
      // בדוק שlastLogin התעדכן
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user!.lastLogin).toBeDefined();
    });
    
    it('should not login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('פרטי התחברות שגויים');
    });
    
    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('פרטי התחברות שגויים');
    });
    
    it('should require email and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('נא לספק כתובת אימייל וסיסמה');
    });
  });
  
  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;
    let userId: string;
    
    beforeEach(async () => {
      // צור משתמש ורענן טוקן
      const user = new User({
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'משתמש בדיקה'
      });
      
      await user.save();
      userId = user._id.toString();
      
      // צור refresh token
      refreshToken = user.getRefreshToken();
      await user.save();
    });
    
    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      
      // וודא שהטוקן החדש תקף
      const decoded = jwt.verify(
        response.body.accessToken,
        process.env.JWT_SECRET as string
      ) as { id: string };
      
      expect(decoded.id).toBe(userId);
    });
    
    it('should not refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא תקף');
    });
    
    it('should not refresh if refresh token not found in user', async () => {
      // צור משתמש אחר עם טוקן משלו
      const otherUser = new User({
        email: 'other@example.com',
        passwordHash: 'password123',
        name: 'משתמש אחר'
      });
      
      await otherUser.save();
      const otherRefreshToken = otherUser.getRefreshToken();
      await otherUser.save();
      
      // מחק את הטוקן מהמשתמש
      otherUser.refreshTokens = [];
      await otherUser.save();
      
      // נסה לרענן עם טוקן שכבר אינו קיים
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: otherRefreshToken });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/auth/me', () => {
    let token: string;
    let user: any;
    
    beforeEach(async () => {
      // צור משתמש וטוקן
      user = new User({
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'משתמש בדיקה',
        avatar: 'https://example.com/avatar.jpg'
      });
      
      await user.save();
      token = user.getSignedJwtToken();
    });
    
    it('should get current user details with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.email).toBe(user.email);
      expect(response.body.data.name).toBe(user.name);
      expect(response.body.data.avatar).toBe(user.avatar);
    });
    
    it('should not access with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should not access without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/auth/logout', () => {
    let refreshToken: string;
    let token: string;
    let user: any;
    
    beforeEach(async () => {
      // צור משתמש וטוקנים
      user = new User({
        email: 'test@example.com',
        passwordHash: 'password123',
        name: 'משתמש בדיקה'
      });
      
      await user.save();
      token = user.getSignedJwtToken();
      refreshToken = user.getRefreshToken();
      await user.save();
    });
    
    it('should logout and remove refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('נותקת בהצלחה');
      
      // בדוק שהטוקן הוסר
      const updatedUser = await User.findById(user._id);
      expect(updatedUser!.refreshTokens).not.toContain(refreshToken);
    });
    
    it('should not logout without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('חסר refresh token');
    });
    
    it('should not logout without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});