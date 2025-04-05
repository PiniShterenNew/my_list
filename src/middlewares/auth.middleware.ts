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
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'לא מורשה לגשת לנתיב זה',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };

    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    logger.error(`Auth error: ${error.message}`);
    res.status(401).json({
      success: false,
      error: 'לא מורשה לגשת לנתיב זה',
    });
    return;
  }
};

/**
 * מידלוור לבדיקת הרשאות לרשימה ספציפית
 */
export const checkListPermission = (requiredPermission = 'view') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user._id;

      if (!id) {
        next();
        return;
      }

      const list = await require('../models/list.model').default.findById(id);

      if (!list) {
        res.status(404).json({
          success: false,
          error: 'הרשימה לא נמצאה',
        });
        return;
      }

      if (list.owner.toString() === userId.toString()) {
        next();
        return;
      }

      const sharedWith = list.sharedWith.find(
        (share: any) => share.userId.toString() === userId.toString()
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
