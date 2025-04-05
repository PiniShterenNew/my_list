import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import logger from '../utils/logger';

// הרחבת ממשק Request של Express כדי לכלול את המשתמש
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * מידלוור להגנה על נתיבי API שדורשים אימות
 */
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;

    // בדוק אם קיים טוקן בכותרת האוטוריזציה
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      // הוצא את הטוקן מכותרת האוטוריזציה
      token = req.headers.authorization.split(' ')[1];
    } 
    // אם אין טוקן, החזר שגיאת אימות
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'לא מורשה לגשת לנתיב זה',
      });
    }

    // אמת את הטוקן
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };

    // מצא את המשתמש לפי ה-ID מהטוקן
    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    // הוסף את המשתמש לאובייקט הבקשה
    req.user = user;
    next();
  } catch (error: any) {
    logger.error(`Auth error: ${error.message}`);
    return res.status(401).json({
      success: false,
      error: 'לא מורשה לגשת לנתיב זה',
    });
  }
};

/**
 * מידלוור לבדיקת הרשאות לרשימה ספציפית
 */
export const checkListPermission = (requiredPermission = 'view') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // מזהה הרשימה מהפרמטרים של הנתיב
      const userId = req.user._id;

      // אם אין מזהה רשימה, עבור הלאה
      if (!id) {
        return next();
      }

      // בדוק אם קיימת הרשאה לגשת לרשימה
      const list = await require('../models/list.model').default.findById(id);

      if (!list) {
        return res.status(404).json({
          success: false,
          error: 'הרשימה לא נמצאה',
        });
      }

      // בדוק אם המשתמש הוא הבעלים של הרשימה
      if (list.owner.toString() === userId.toString()) {
        return next();
      }

      // בדוק אם הרשימה משותפת עם המשתמש ובאיזו רמת הרשאה
      const sharedWith = list.sharedWith.find(
        (share: any) => share.userId.toString() === userId.toString()
      );

      if (!sharedWith) {
        return res.status(403).json({
          success: false,
          error: 'אין לך הרשאה לגשת לרשימה זו',
        });
      }

      // בדוק את רמת ההרשאה הנדרשת
      const permissions = {
        view: ['view', 'edit', 'admin'],
        edit: ['edit', 'admin'],
        admin: ['admin'],
      };

      if (!permissions[requiredPermission as keyof typeof permissions].includes(sharedWith.permissions)) {
        return res.status(403).json({
          success: false,
          error: `אין לך הרשאת ${requiredPermission} לרשימה זו`,
        });
      }

      next();
    } catch (error: any) {
      logger.error(`Permission check error: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'שגיאה בבדיקת הרשאות',
      });
    }
  };
};