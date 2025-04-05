import { Request, Response } from 'express';
import User from '../models/user.model';
import logger from '../utils/logger';

// @desc    קבלת פרופיל המשתמש המלא
// @route   GET /api/users/me
// @access  פרטי
export const getUserProfile = async (req: Request, res: Response) => {
  try {
    // טען את כל הנתונים, כולל הרחבה של רשימות וכו'
    const user = await User.findById(req.user._id)
      .select('-passwordHash -refreshTokens')
      .populate({
        path: 'favoriteItems',
        select: 'name image category defaultUnit',
      })
      .populate({
        path: 'contacts',
        select: 'name email avatar',
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error(`Get user profile error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת פרופיל משתמש',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    עדכון פרטי משתמש
// @route   PUT /api/users/me
// @access  פרטי
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const { name, avatar } = req.body;

    // בנה אובייקט עדכון
    const updateData: any = {};

    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;

    // עדכן את המשתמש
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select('-passwordHash -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error(`Update user profile error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון פרטי משתמש',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    עדכון העדפות משתמש
// @route   PUT /api/users/me/preferences
// @access  פרטי
export const updateUserPreferences = async (req: Request, res: Response) => {
  try {
    const { preferences } = req.body;

    if (!preferences) {
      return res.status(400).json({
        success: false,
        error: 'לא סופקו העדפות לעדכון',
      });
    }

    // עדכן את ההעדפות
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences },
      {
        new: true,
        runValidators: true,
      }
    ).select('-passwordHash -refreshTokens');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    res.status(200).json({
      success: true,
      data: user.preferences,
    });
  } catch (error: any) {
    logger.error(`Update user preferences error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון העדפות משתמש',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    חיפוש משתמשים
// @route   GET /api/users/search
// @access  פרטי
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'נא לספק מחרוזת חיפוש',
      });
    }

    // חפש משתמשים לפי שם או אימייל
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: req.user._id }, // אל תכלול את המשתמש הנוכחי
    })
      .select('name email avatar')
      .limit(10);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error: any) {
    logger.error(`Search users error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בחיפוש משתמשים',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    קבלת אנשי קשר
// @route   GET /api/users/contacts
// @access  פרטי
export const getUserContacts = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user._id)
      .select('contacts')
      .populate({
        path: 'contacts',
        select: 'name email avatar',
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    res.status(200).json({
      success: true,
      count: user.contacts.length,
      data: user.contacts,
    });
  } catch (error: any) {
    logger.error(`Get user contacts error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת אנשי קשר',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    הוספת איש קשר
// @route   POST /api/users/contacts
// @access  פרטי
export const addUserContact = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'נא לספק מזהה משתמש',
      });
    }

    // בדוק שהמשתמש אינו מנסה להוסיף את עצמו
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'לא ניתן להוסיף את עצמך לאנשי הקשר',
      });
    }

    // בדוק שהמשתמש קיים
    const contactUser = await User.findById(userId).select('name email avatar');

    if (!contactUser) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש המבוקש לא נמצא',
      });
    }

    // בדוק אם המשתמש כבר בין אנשי הקשר
    const userToUpdate = await User.findById(req.user._id);
    
    if (!userToUpdate) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    if (userToUpdate.contacts.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: 'המשתמש כבר נמצא ברשימת אנשי הקשר שלך',
      });
    }

    // הוסף את המשתמש לאנשי הקשר
    userToUpdate.contacts.push(userId);
    await userToUpdate.save();

    res.status(200).json({
      success: true,
      data: contactUser,
    });
  } catch (error: any) {
    logger.error(`Add user contact error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהוספת איש קשר',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    הסרת איש קשר
// @route   DELETE /api/users/contacts/:id
// @access  פרטי
export const removeUserContact = async (req: Request, res: Response) => {
  try {
    const contactId = req.params.id;

    // מצא את המשתמש והסר את איש הקשר
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'המשתמש לא נמצא',
      });
    }

    // בדוק אם איש הקשר קיים
    if (!user.contacts.includes(contactId)) {
      return res.status(400).json({
        success: false,
        error: 'איש הקשר אינו ברשימת אנשי הקשר שלך',
      });
    }

    // הסר את איש הקשר
    user.contacts = user.contacts.filter(
      (contact) => contact.toString() !== contactId
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: 'איש הקשר הוסר בהצלחה',
    });
  } catch (error: any) {
    logger.error(`Remove user contact error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהסרת איש קשר',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};