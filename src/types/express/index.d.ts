// הרחבת סוג Request של Express
import { IUser } from '../../models/user.model';
import { IList } from '../../models/list.model';

// הגדרת המודול express כדי להרחיב את הטיפוסים שלו
declare global {
  namespace Express {
    // הרחבת ממשק Request עם התכונות הנוספות
    interface Request {
      user: IUser & { _id: string };
      list?: IList; // הוספת שדה רשימה אופציונלי
    }
  }
}

// ייצוא ריק כדי שהמודול יהיה תקף
export {}