import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// טען הגדרות סביבת טסטים
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

let mongoServer: MongoMemoryServer;

// הגדר הפעלה לפני כל הטסטים
beforeAll(async () => {
  // צור שרת MongoDB זמני בזיכרון
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // דרוס את כתובת ה-MongoDB
  process.env.MONGODB_URI = mongoUri;
  
  // התחבר למסד הנתונים
  await mongoose.connect(mongoUri);
});

// הגדר ניקוי אחרי כל הטסטים
afterAll(async () => {
  // נתק מהמסד נתונים
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // סגור את השרת הזמני
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// הגדר זמן פסק ארוך יותר לטסטים
jest.setTimeout(60000);

// נטרל לוגים בזמן בדיקות
// (אפשר להסיר את זה אם רוצים לראות לוגים בבדיקות)
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
}));