import { Request, Response } from 'express';
import mongoose from 'mongoose';
import List from '../models/list.model';
import ListItem from '../models/listItem.model';
import Notification from '../models/notification.model';
import logger from '../utils/logger';

// @desc    קבלת כל הרשימות של המשתמש
// @route   GET /api/lists
// @access  פרטי
export const getLists = async (req: Request, res: Response): Promise<void> => {
  try {
    // מצא את כל הרשימות ששייכות למשתמש
    const lists = await List.find({ owner: req.user._id })
      .sort({ lastModified: -1 })
      .populate({
        path: 'owner',
        select: 'name avatar',
      });

    res.status(200).json({
      success: true,
      count: lists.length,
      data: lists,
    });
    return;
  } catch (error: any) {
    logger.error(`Get lists error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת רשימות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    יצירת רשימה חדשה
// @route   POST /api/lists
// @access  פרטי
export const createList = async (req: Request, res: Response): Promise<void> => {
  try {
    // הוסף את המשתמש כבעלים
    req.body.owner = req.user._id;
    
    // צור את הרשימה
    const list = await List.create(req.body);

    // הוסף פעולה לדף ההיסטוריה
    list.history.push({
      action: 'create',
      userId: new mongoose.Types.ObjectId(req.user._id.toString()),
      timestamp: new Date(),
      details: { name: list.name }
    });
    
    await list.save();

    res.status(201).json({
      success: true,
      data: list,
    });
    return;
  } catch (error: any) {
    logger.error(`Create list error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה ביצירת רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    קבלת רשימה ספציפית
// @route   GET /api/lists/:id
// @access  פרטי
export const getList = async (req: Request, res: Response): Promise<void> => {
  try {
    // השתמש ברשימה שכבר נבדקה ב-middleware
    if (!req.list) {
      // אם מסיבה כלשהי הרשימה לא קיימת בבקשה, טען אותה
      const list = await List.findById(req.params.id)
        .populate({
          path: 'owner',
          select: 'name avatar',
        })
        .populate({
          path: 'sharedWith.userId',
          select: 'name avatar email',
        });

      if (!list) {
        res.status(404).json({
          success: false,
          error: 'הרשימה לא נמצאה',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: list,
      });
    } else {
      // השתמש ברשימה שכבר נבדקה ונטענה ב-middleware
      const populatedList = await List.findById(req.list._id)
        .populate({
          path: 'owner',
          select: 'name avatar',
        })
        .populate({
          path: 'sharedWith.userId',
          select: 'name avatar email',
        });

      res.status(200).json({
        success: true,
        data: populatedList,
      });
    }
    return;
  } catch (error: any) {
    logger.error(`Get list error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    עדכון רשימה
// @route   PUT /api/lists/:id
// @access  פרטי (בעלים או הרשאת עריכה)
export const updateList = async (req: Request, res: Response): Promise<void> => {
  try {
    // השתמש ברשימה שכבר נבדקה ב-middleware
    if (!req.list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // עדכן את הרשימה
    const updatedList = await List.findByIdAndUpdate(req.list._id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedList) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // הוסף פעולה לדף ההיסטוריה
    updatedList.history.push({
      action: 'update',
      userId: new mongoose.Types.ObjectId(req.user._id.toString()),
      timestamp: new Date(),
      details: req.body
    });
    
    await updatedList.save();

    res.status(200).json({
      success: true,
      data: updatedList,
    });
    return;
  } catch (error: any) {
    logger.error(`Update list error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    מחיקת רשימה
// @route   DELETE /api/lists/:id
// @access  פרטי (רק בעלים)
export const deleteList = async (req: Request, res: Response): Promise<void> => {
  try {
    // השתמש ברשימה שכבר נבדקה ב-middleware
    if (!req.list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // וודא שהמשתמש הוא הבעלים של הרשימה
    // הערה: בדיקה זו מיותרת כי middleware כבר בדק הרשאות admin,
    // אבל משאירים אותה כשכבת הגנה נוספת
    if (req.list.owner.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        error: 'אין לך הרשאה למחוק רשימה זו',
      });
      return;
    }

    // מחק את כל הפריטים ברשימה
    await ListItem.deleteMany({ listId: req.list._id });

    // מחק את הרשימה
    await req.list.deleteOne();

    res.status(200).json({
      success: true,
      message: 'הרשימה נמחקה בהצלחה',
    });
    return;
  } catch (error: any) {
    logger.error(`Delete list error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה במחיקת רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    עדכון סטטוס רשימה
// @route   PUT /api/lists/:id/status
// @access  פרטי (בעלים או הרשאת עריכה)
export const updateListStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;

    if (!status || !['active', 'shopping', 'completed'].includes(status)) {
      res.status(400).json({
        success: false,
        error: 'נא לספק סטטוס תקף',
      });
      return;
    }

    // השתמש ברשימה שכבר נבדקה ב-middleware
    if (!req.list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // עדכן את הסטטוס
    req.list.status = status;
    
    // הוסף פעולה לדף ההיסטוריה
    req.list.history.push({
      action: 'status_change',
      userId: new mongoose.Types.ObjectId(req.user._id.toString()),
      timestamp: new Date(),
      details: { status }
    });
    
    await req.list.save();

    res.status(200).json({
      success: true,
      data: req.list,
    });
    return;
  } catch (error: any) {
    logger.error(`Update list status error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון סטטוס רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    קבלת רשימות משותפות עם המשתמש
// @route   GET /api/lists/shared
// @access  פרטי
export const getSharedLists = async (req: Request, res: Response): Promise<void> => {
  try {
    // מצא את כל הרשימות שמשותפות עם המשתמש
    const lists = await List.find({ 
      'sharedWith.userId': req.user._id 
    })
      .sort({ lastModified: -1 })
      .populate({
        path: 'owner',
        select: 'name avatar',
      });

    res.status(200).json({
      success: true,
      count: lists.length,
      data: lists,
    });
    return;
  } catch (error: any) {
    logger.error(`Get shared lists error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת רשימות משותפות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    שיתוף רשימה עם משתמשים
// @route   POST /api/lists/:id/share
// @access  פרטי (בעלים או הרשאת admin)
export const shareList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
      res.status(400).json({
        success: false,
        error: 'נא לספק רשימת משתמשים לשיתוף',
      });
      return;
    }

    const list = await List.findById(req.params.id);

    if (!list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // בדוק הרשאות
    const isOwner = list.owner.toString() === req.user._id.toString();
    const shareData = list.sharedWith.find(
      (share: any) => share.userId.toString() === req.user._id.toString() && share.permissions === 'admin'
    );

    if (!isOwner && !shareData) {
      res.status(403).json({
        success: false,
        error: 'אין לך הרשאה לשתף רשימה זו',
      });
      return;
    }

    // עדכן את רשימת המשתמשים המשותפים
    for (const user of users) {
      // בדוק שהמשתמש אינו הבעלים
      if (user.userId === list.owner.toString()) {
        continue;
      }

      // בדוק אם המשתמש כבר משותף
      const existingShare = list.sharedWith.find(
        (share: any) => share.userId.toString() === user.userId
      );

      if (existingShare) {
        // עדכן את ההרשאות
        existingShare.permissions = user.permissions || 'view';
      } else {
        // הוסף שיתוף חדש
        list.sharedWith.push({
          userId: user.userId,
          permissions: user.permissions || 'view',
          joinedAt: new Date(),
        });

        // שלח התראה למשתמש
        await Notification.create({
          userId: user.userId,
          type: 'share',
          message: `${req.user.name} שיתף/ה איתך רשימת קניות: ${list.name}`,
          relatedId: list._id,
          refModel: 'List',
          actionUrl: `/lists/${list._id}`,
        });
      }
    }

    // הוסף פעולה לדף ההיסטוריה
    list.history.push({
      action: 'share',
      userId: new mongoose.Types.ObjectId(req.user._id.toString()),
      timestamp: new Date(),
      details: { users }
    });

    await list.save();

    res.status(200).json({
      success: true,
      data: list,
    });
    return;
  } catch (error: any) {
    logger.error(`Share list error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בשיתוף רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    ביטול שיתוף רשימה עם משתמש
// @route   DELETE /api/lists/:id/share/:userId
// @access  פרטי (בעלים או הרשאת admin)
export const removeListShare = async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await List.findById(req.params.id);
    const userIdToRemove = req.params.userId;

    if (!list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // בדוק הרשאות
    const isOwner = list.owner.toString() === req.user._id.toString();
    const isSelfRemoval = userIdToRemove === req.user._id.toString();
    const isAdmin = list.sharedWith.find(
      (share: any) => share.userId.toString() === req.user._id.toString() && share.permissions === 'admin'
    );

    if (!isOwner && !isAdmin && !isSelfRemoval) {
      res.status(403).json({
        success: false,
        error: 'אין לך הרשאה להסיר משתמש מרשימה זו',
      });
      return;
    }

    // הסר את המשתמש מהרשימה
    list.sharedWith = list.sharedWith.filter(
      (share: any) => share.userId.toString() !== userIdToRemove
    );

    // הוסף פעולה לדף ההיסטוריה
    list.history.push({
      action: 'unshare',
      userId: new mongoose.Types.ObjectId(req.user._id.toString()),
      timestamp: new Date(),
      details: { removedUserId: userIdToRemove }
    });

    await list.save();

    res.status(200).json({
      success: true,
      message: 'המשתמש הוסר בהצלחה מהרשימה המשותפת',
    });
    return;
  } catch (error: any) {
    logger.error(`Remove list share error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהסרת שיתוף רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    סיום תהליך קנייה
// @route   POST /api/lists/:id/complete
// @access  פרטי (בעלים או הרשאת עריכה)
export const completeShoppingList = async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await List.findById(req.params.id);

    if (!list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // בדוק הרשאות
    const isOwner = list.owner.toString() === req.user._id.toString();
    const shareData = list.sharedWith.find(
      (share: any) => share.userId.toString() === req.user._id.toString()
    );
    
    const hasEditPermission = shareData && 
      (shareData.permissions === 'edit' || shareData.permissions === 'admin');

    if (!isOwner && !hasEditPermission) {
      res.status(403).json({
        success: false,
        error: 'אין לך הרשאה לסיים את תהליך הקנייה ברשימה זו',
      });
      return;
    }

    // עדכן את סטטוס הרשימה
    list.status = 'completed';
    
    // טיפול בפריטים בהתאם לסוג הרשימה
    const items = await ListItem.find({ listId: list._id });
    
    if (list.type === 'permanent') {
      // ברשימה קבועה, רק מאפס את הפריטים המסומנים
      for (const item of items) {
        if (item.isChecked) {
          item.isChecked = false;
          item.checkedAt = undefined;
          await item.save();
        }
      }
    } else {
      // ברשימה חד-פעמית, אפשר להשאיר את הפריטים כמו שהם
      // אפשר להוסיף כאן לוגיקה נוספת אם צריך
    }
    
    // הוסף פעולה לדף ההיסטוריה
    list.history.push({
      action: 'complete_shopping',
      userId: new mongoose.Types.ObjectId(req.user._id.toString()),
      timestamp: new Date(),
      details: { itemsCount: items.length }
    });
    
    await list.save();

    res.status(200).json({
      success: true,
      message: 'תהליך הקנייה הושלם בהצלחה',
      data: {
        list,
        type: list.type,
      },
    });
    return;
  } catch (error: any) {
    logger.error(`Complete shopping list error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בסיום תהליך הקנייה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};