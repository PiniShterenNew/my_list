import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import List from '../models/list.model';
import logger from '../utils/logger';

// הגדרת ממשק מורחב לבקשות
interface IExtendedRequest extends Request {
  user: IUser & { _id: string };
  list?: any;
}

// טיפוס להרשאות רשימה
type ListPermission = 'view' | 'edit' | 'admin';

// ממשק לתוצאת בדיקת הרשאות
interface IPermissionCheckResult {
  hasPermission: boolean;
  list?: any; // מחזיר את הרשימה אם נמצאה
  error?: string;
}

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

      // הוסף את המשתמש לבקשה
      const userObj = user.toObject();
      (req as IExtendedRequest).user = userObj as IUser & { _id: string };
      (req as IExtendedRequest).user._id = user._id?.toString() || user.id?.toString();
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

/**
 * בדיקת הרשאות משתמש לרשימה
 * @param requiredPermission סוג ההרשאה הנדרשת (view, edit, admin)
 * @returns פונקציית middleware שבודקת את ההרשאות
 */
export const checkListPermission = (requiredPermission: ListPermission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const listId = req.params.id;
      
      // בדוק שיש מזהה רשימה
      if (!listId) {
        res.status(400).json({
          success: false,
          error: 'מזהה רשימה חסר',
        });
        return;
      }

      // בדוק הרשאות
      const permissionResult = await checkUserListPermission(
        String((req as IExtendedRequest).user._id), 
        String(listId), 
        requiredPermission
      );
      
      if (!permissionResult.hasPermission) {
        res.status(403).json({
          success: false,
          error: permissionResult.error || 'אין לך הרשאה מספקת לבצע פעולה זו',
        });
        return;
      }

      // הוסף את הרשימה לבקשה אם נמצאה
      if (permissionResult.list) {
        (req as IExtendedRequest).list = permissionResult.list;
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

/**
 * בדיקת הרשאות משתמש לרשימה
 * @param userId מזהה המשתמש
 * @param listId מזהה הרשימה
 * @param requiredPermission סוג ההרשאה הנדרשת
 * @returns תוצאת בדיקת ההרשאות
 */
async function checkUserListPermission(
  userId: string,
  listId: string,
  requiredPermission: ListPermission
): Promise<IPermissionCheckResult> {
  try {
    // מצא את הרשימה
    const list = await List.findById(listId);

    if (!list) {
      return {
        hasPermission: false,
        error: 'הרשימה לא נמצאה',
      };
    }

    // בדוק אם המשתמש הוא הבעלים
    if (list.owner.toString() === userId) {
      return { hasPermission: true, list };
    }

    // בדוק הרשאות משותפות
    const sharedAccess = list.sharedWith.find(share => share.userId.toString() === userId);
    if (sharedAccess) {
      switch (requiredPermission) {
        case 'view':
          // צפייה מותרת לכל סוגי ההרשאות
          return { hasPermission: true, list };
        case 'edit':
          // עריכה מותרת להרשאות edit ו-admin
          if (['edit', 'admin'].includes(sharedAccess.permissions)) {
            return { hasPermission: true, list };
          }
          return {
            hasPermission: false,
            error: 'אין לך הרשאה מספקת לבצע פעולה זו',
          };
        case 'admin':
          // הרשאות admin רק למנהל
          if (sharedAccess.permissions === 'admin') {
            return { hasPermission: true, list };
          }
          return {
            hasPermission: false,
            error: 'אין לך הרשאה מספקת לבצע פעולה זו',
          };
      }
    }

    return {
      hasPermission: false,
      error: 'אין לך הרשאה מספקת לבצע פעולה זו',
    };
  } catch (error: any) {
    logger.error(`Permission check error: ${error.message}`);
    return {
      hasPermission: false,
      error: 'שגיאה בבדיקת הרשאות',
    };
  }
}