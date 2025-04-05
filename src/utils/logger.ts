import winston from 'winston';
import path from 'path';

// קביעת רמת הלוג מתוך משתני הסביבה
const level = process.env.LOG_LEVEL || 'info';

// הגדרת פורמט הלוגים
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// הגדר טרנספורטרים (לאן הלוגים ישלחו)
const transports = [
  // כתוב לקונסול
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
      )
    ),
  }),
  // כתוב לקובץ לוג כללי
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    level: 'info',
  }),
  // כתוב לקובץ לוג שגיאות
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
  }),
];

// יצירת מופע הלוגר
const logger = winston.createLogger({
  level,
  format,
  transports,
  exitOnError: false,
});

export default logger;