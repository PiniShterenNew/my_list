import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import logger from '../utils/logger';

// מידלוור להגנה על נתיבי API שדורשים אימות
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // בדוק אם יש טוקן בכותרת Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // וודא שיש טוקן
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'לא מורשה לגשת לנתיב זה - חסר טוקן',
      });
      return;
    }

    try {
      // אימות הטוקן
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };

      // מצא את המשתמש לפי ה-ID מהטוקן
      const user = await User.findById(decoded.id);

      // וודא שהמשתמש קיים
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'המשתמש לא נמצא',
        });
        return;
      }

      // שמור את המשתמש באובייקט הבקשה
      req.user = user;
      next();
    } catch (error) {
      logger.error(`Token verification error: ${error}`);
      res.status(401).json({
        success: false,
        error: 'לא מורשה לגשת לנתיב זה - טוקן לא תקף',
      });
      return;
    }
  } catch (error: any) {
    logger.error(`Auth error: ${error.message}`);
    res.status(401).json({
      success: false,
      error: 'לא מורשה לגשת לנתיב זה',
    });
    return;
  }
};

// מידלוור לבדיקת הרשאות לרשימה ספציפית
export const checkListPermission = (requiredPermission = 'view') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?._id;

      if (!id) {
        next();
        return;
      }

      const List = require('../models/list.model').default;
      const list = await List.findById(id);

      if (!list) {
        res.status(404).json({
          success: false,
          error: 'הרשימה לא נמצאה',
        });
        return;
      }

      if (list.owner.toString() === userId?.toString()) {
        next();
        return;
      }

      const sharedWith = list.sharedWith.find(
        (share: any) => share.userId.toString() === userId?.toString()
      );

      if (!sharedWith) {
        res.status(403).json({
          success: false,
          error: 'אין לך הרשאה לגשת לרשימה זו',
        });
        return;
      }

      const permissions = {
        view: ['view', 'edit', 'admin'],
        edit: ['edit', 'admin'],
        admin: ['admin'],
      };

      if (!permissions[requiredPermission as keyof typeof permissions].includes(sharedWith.permissions)) {
        res.status(403).json({
          success: false,
          error: `אין לך הרשאת ${requiredPermission} לרשימה זו`,
        });
        return;
      }

      next();
    } catch (error: any) {
      logger.error(`Permission check error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'שגיאה בבדיקת הרשאות',
      });
      return;
    }
  };
};