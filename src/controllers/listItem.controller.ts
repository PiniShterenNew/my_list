import { Request, Response } from 'express';
import mongoose from 'mongoose';
import List from '../models/list.model';
import ListItem from '../models/listItem.model';
import Product from '../models/product.model';
import Category from '../models/category.model';
import logger from '../utils/logger';

// @desc    קבלת כל הפריטים ברשימה
// @route   GET /api/lists/:id/items
// @access  פרטי
export const getListItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const listId = req.params.id;
    
    // וודא שהרשימה קיימת והמשתמש רשאי לגשת אליה
    const list = await List.findById(listId);
    
    if (!list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // בדוק הרשאות
    const isOwner = list.owner.toString() === req.user._id.toString();
    const isShared = list.sharedWith.some(
      (share: any) => share.userId.toString() === req.user._id.toString()
    );

    if (!isOwner && !isShared) {
      res.status(403).json({
        success: false,
        error: 'אין לך הרשאה לגשת לרשימה זו',
      });
      return;
    }

    // קבל את כל הפריטים ברשימה
    const items = await ListItem.find({ listId })
      .populate({
        path: 'productId',
        select: 'image defaultUnit availableUnits',
      })
      .populate({
        path: 'addedBy',
        select: 'name',
      })
      .sort({ 'category.main': 1, customOrder: 1, addedAt: 1 });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items,
    });
    return;
  } catch (error: any) {
    logger.error(`Get list items error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת פריטי רשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    הוספת פריט לרשימה
// @route   POST /api/lists/:id/items
// @access  פרטי (בעלים או הרשאת עריכה)
export const addListItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const listId = req.params.id;
    
    // וודא שהרשימה קיימת והמשתמש רשאי לעדכן אותה
    const list = await List.findById(listId);
    
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
        error: 'אין לך הרשאה להוסיף פריטים לרשימה זו',
      });
      return;
    }

    // הוסף את מזהה הרשימה והמשתמש שהוסיף את הפריט
    req.body.listId = listId;
    req.body.addedBy = req.user._id;

    // אם יש מזהה מוצר, נסה לטעון מידע נוסף על המוצר
    if (req.body.productId) {
      const product = await Product.findById(req.body.productId);
      
      if (product) {
        // השלם פרטים חסרים מהמוצר אם לא סופקו
        if (!req.body.name) req.body.name = product.name;
        if (!req.body.category) req.body.category = product.category;
        if (!req.body.unit) req.body.unit = product.defaultUnit;
      }
    }

    // וודא שיש קטגוריה ראשית
    if (!req.body.category || !req.body.category.main) {
      res.status(400).json({
        success: false,
        error: 'נא לספק קטגוריה ראשית לפריט',
      });
      return;
    }

    // צור את הפריט
    const item = await ListItem.create(req.body);

    // עדכן את רשימת הקטגוריות ששימשו ברשימה
    if (!list.categoriesUsed.includes(req.body.category.main)) {
      list.categoriesUsed.push(req.body.category.main);
      list.markModified('categoriesUsed');
    }

    // עדכן את תאריך העדכון האחרון של הרשימה
    list.lastModified = new Date();
    await list.save();

    // החזר את הפריט עם מידע מלא
    const populatedItem = await ListItem.findById(item._id)
      .populate({
        path: 'productId',
        select: 'image defaultUnit availableUnits',
      })
      .populate({
        path: 'addedBy',
        select: 'name',
      });

    res.status(201).json({
      success: true,
      data: populatedItem,
    });
    return;
  } catch (error: any) {
    logger.error(`Add list item error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהוספת פריט לרשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    עדכון פריט ברשימה
// @route   PUT /api/lists/:id/items/:itemId
// @access  פרטי (בעלים או הרשאת עריכה)
export const updateListItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const listId = req.params.id;
    const itemId = req.params.itemId;
    
    // וודא שהרשימה קיימת והמשתמש רשאי לעדכן אותה
    const list = await List.findById(listId);
    
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
        error: 'אין לך הרשאה לעדכן פריטים ברשימה זו',
      });
      return;
    }

    // וודא שהפריט קיים ושייך לרשימה המבוקשת
    let item = await ListItem.findOne({ _id: itemId, listId });
    
    if (!item) {
      res.status(404).json({
        success: false,
        error: 'הפריט לא נמצא ברשימה זו',
      });
      return;
    }

    // עדכן את הפריט
    item = await ListItem.findByIdAndUpdate(itemId, req.body, {
      new: true,
      runValidators: true,
    })
      .populate({
        path: 'productId',
        select: 'image defaultUnit availableUnits',
      })
      .populate({
        path: 'addedBy',
        select: 'name',
      });

    // בדוק אם הקטגוריה השתנתה ועדכן את רשימת הקטגוריות של הרשימה אם צריך
    if (req.body.category && req.body.category.main && !list.categoriesUsed.includes(req.body.category.main)) {
      list.categoriesUsed.push(req.body.category.main);
      list.markModified('categoriesUsed');
    }

    // עדכן את תאריך העדכון האחרון של הרשימה
    list.lastModified = new Date();
    await list.save();

    res.status(200).json({
      success: true,
      data: item,
    });
    return;
  } catch (error: any) {
    logger.error(`Update list item error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון פריט ברשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    מחיקת פריט מרשימה
// @route   DELETE /api/lists/:id/items/:itemId
// @access  פרטי (בעלים או הרשאת עריכה)
export const deleteListItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const listId = req.params.id;
    const itemId = req.params.itemId;
    
    // וודא שהרשימה קיימת והמשתמש רשאי לעדכן אותה
    const list = await List.findById(listId);
    
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
        error: 'אין לך הרשאה למחוק פריטים מרשימה זו',
      });
      return;
    }

    // וודא שהפריט קיים ושייך לרשימה המבוקשת
    const item = await ListItem.findOne({ _id: itemId, listId });
    
    if (!item) {
      res.status(404).json({
        success: false,
        error: 'הפריט לא נמצא ברשימה זו',
      });
      return;
    }

    // מחק את הפריט
    await item.deleteOne();

    // עדכן את תאריך העדכון האחרון של הרשימה
    list.lastModified = new Date();
    await list.save();

    res.status(200).json({
      success: true,
      message: 'הפריט נמחק בהצלחה',
    });
    return;
  } catch (error: any) {
    logger.error(`Delete list item error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה במחיקת פריט מהרשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    סימון פריט כנרכש או ביטול סימון
// @route   PUT /api/lists/:id/items/:itemId/check
// @access  פרטי (גם הרשאת צפייה מספיקה)
export const toggleListItemCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const listId = req.params.id;
    const itemId = req.params.itemId;
    const { isChecked } = req.body;
    
    // וודא שהרשימה קיימת והמשתמש רשאי לגשת אליה
    const list = await List.findById(listId);
    
    if (!list) {
      res.status(404).json({
        success: false,
        error: 'הרשימה לא נמצאה',
      });
      return;
    }

    // בדוק הרשאות - גם הרשאת צפייה בלבד מספיקה לסימון פריט
    const isOwner = list.owner.toString() === req.user._id.toString();
    const isShared = list.sharedWith.some(
      (share: any) => share.userId.toString() === req.user._id.toString()
    );

    if (!isOwner && !isShared) {
      res.status(403).json({
        success: false,
        error: 'אין לך הרשאה לעדכן פריטים ברשימה זו',
      });
      return;
    }

    // וודא שהפריט קיים ושייך לרשימה המבוקשת
    let item = await ListItem.findOne({ _id: itemId, listId });
    
    if (!item) {
      res.status(404).json({
        success: false,
        error: 'הפריט לא נמצא ברשימה זו',
      });
      return;
    }

    // עדכן את הסטטוס
    item.isChecked = isChecked === undefined ? !item.isChecked : Boolean(isChecked);
    
    // עדכן את תאריך הרכישה אם הפריט סומן
    if (item.isChecked) {
      item.checkedAt = new Date();
    } else {
      item.checkedAt = undefined;
    }
    
    await item.save();

    res.status(200).json({
      success: true,
      data: item,
    });
    return;
  } catch (error: any) {
    logger.error(`Toggle list item check error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בסימון/ביטול סימון פריט ברשימה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};