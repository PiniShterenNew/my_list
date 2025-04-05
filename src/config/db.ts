import mongoose from 'mongoose';
import logger from '../utils/logger';

/*************  ✨ Windsurf Command ⭐  *************/
/*******  0ecac602-4396-4f31-8f90-8c63ad95588d  *******/
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shopping-list');
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    
    // הגדרות כלליות למונגוס
    mongoose.set('debug', process.env.NODE_ENV === 'development');
    
  } catch (error: any) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

// יצירת אינדקסים גלובליים וכדומה
export const setupIndexes = async () => {
  // כאן יתבצעו פעולות נוספות על בסיס הנתונים במידת הצורך
};