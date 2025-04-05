import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// טען הגדרות סביבת טסטים
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

let mongoServer: MongoMemoryServer;

// הגדר הפעלה לפני כל הטסטים
beforeAll(async () => {
  console.log("Setting up test environment...");
  
  // וודא שאין התחברות קיימת
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // צור שרת MongoDB זמני בזיכרון
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // דרוס את כתובת ה-MongoDB
  process.env.MONGODB_URI = mongoUri;
  
  // התחבר למסד הנתונים
  await mongoose.connect(mongoUri);
  console.log(`Connected to in-memory MongoDB at ${mongoUri}`);
  
  // וודא שמשתני הסביבה הנדרשים מוגדרים
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret';
  }
  
  if (!process.env.REFRESH_TOKEN_SECRET) {
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret';
  }
});

// הגדר ניקוי אחרי כל הטסטים
afterAll(async () => {
  console.log("Tearing down test environment...");
  
  // נתק מהמסד נתונים
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  // סגור את השרת הזמני
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  console.log('Disconnected from in-memory MongoDB');
});

// נקה מסד נתונים בין בדיקות
afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
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