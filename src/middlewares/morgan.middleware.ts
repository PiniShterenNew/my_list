import morgan from 'morgan';
import logger from '../utils/logger';

// יצירת זרם לוג מותאם שכותב ללוגר של וינסטון במקום לקונסול
const stream = {
  write: (message: string) => {
    // הסר שורת מעבר חדשה בסוף
    const logMessage = message.trim();
    logger.http(logMessage);
  },
};

// הגדר פורמט מותאם לבקשות HTTP
const morganFormat = process.env.NODE_ENV === 'production' 
  ? 'combined'  // פורמט מפורט יותר לסביבת ייצור
  : 'dev';      // פורמט קריא יותר לסביבת פיתוח

// יצירת מידלוור של מורגן
const morganMiddleware = morgan(morganFormat, { stream });

export default morganMiddleware;