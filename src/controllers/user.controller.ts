import { Request, Response } from 'express';
import User from '../models/user.model';
import logger from '../utils/logger';

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const user = await User.findById(req.user._id)
      .select('-passwordHash -refreshTokens')
      .populate({ path: 'favoriteItems', select: 'name image category defaultUnit' })
      .populate({ path: 'contacts', select: 'name email avatar' });

    if (!user) {
      res.status(404).json({ success: false, error: 'המשתמש לא נמצא' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    logger.error(`Get user profile error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בקבלת פרופיל משתמש', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const { name, avatar } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (avatar) updateData.avatar = avatar;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true }).select('-passwordHash -refreshTokens');

    if (!user) {
      res.status(404).json({ success: false, error: 'המשתמש לא נמצא' });
      return;
    }

    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    logger.error(`Update user profile error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בעדכון פרטי משתמש', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const updateUserPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const { preferences } = req.body;

    if (!preferences) {
      res.status(400).json({ success: false, error: 'לא סופקו העדפות לעדכון' });
      return;
    }

    const user = await User.findByIdAndUpdate(req.user._id, { preferences }, { new: true, runValidators: true }).select('-passwordHash -refreshTokens');

    if (!user) {
      res.status(404).json({ success: false, error: 'המשתמש לא נמצא' });
      return;
    }

    res.status(200).json({ success: true, data: user.preferences });
  } catch (error: any) {
    logger.error(`Update user preferences error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בעדכון העדפות משתמש', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const query = req.query.q as string;

    if (!query) {
      res.status(400).json({ success: false, error: 'נא לספק מחרוזת חיפוש' });
      return;
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      _id: { $ne: req.user._id },
    }).select('name email avatar').limit(10);

    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error: any) {
    logger.error(`Search users error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בחיפוש משתמשים', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getUserContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const user = await User.findById(req.user._id).select('contacts').populate({ path: 'contacts', select: 'name email avatar' });

    if (!user) {
      res.status(404).json({ success: false, error: 'המשתמש לא נמצא' });
      return;
    }

    res.status(200).json({ success: true, count: user.contacts.length, data: user.contacts });
  } catch (error: any) {
    logger.error(`Get user contacts error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בקבלת אנשי קשר', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const addUserContact = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, error: 'נא לספק מזהה משתמש' });
      return;
    }

    if (userId === req.user._id.toString()) {
      res.status(400).json({ success: false, error: 'לא ניתן להוסיף את עצמך לאנשי הקשר' });
      return;
    }

    const contactUser = await User.findById(userId).select('name email avatar');
    if (!contactUser) {
      res.status(404).json({ success: false, error: 'המשתמש המבוקש לא נמצא' });
      return;
    }

    const userToUpdate = await User.findById(req.user._id);
    if (!userToUpdate) {
      res.status(404).json({ success: false, error: 'המשתמש לא נמצא' });
      return;
    }

    if (userToUpdate.contacts.includes(userId)) {
      res.status(400).json({ success: false, error: 'המשתמש כבר נמצא ברשימת אנשי הקשר שלך' });
      return;
    }

    userToUpdate.contacts.push(userId);
    await userToUpdate.save();

    res.status(200).json({ success: true, data: contactUser });
  } catch (error: any) {
    logger.error(`Add user contact error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בהוספת איש קשר', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const removeUserContact = async (req: Request, res: Response): Promise<void> => {
  try {
    // בדיקה שהמשתמש קיים
    if (!req.user || !req.user._id) {
      res.status(401).json({ success: false, error: 'לא מורשה' });
      return;
    }

    const contactId = req.params.id;

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404).json({ success: false, error: 'המשתמש לא נמצא' });
      return;
    }

    if (!user.contacts.some(contact => contact.toString() === contactId)) {
      res.status(400).json({ success: false, error: 'איש הקשר אינו ברשימת אנשי הקשר שלך' });
      return;
    }

    user.contacts = user.contacts.filter(contact => contact.toString() !== contactId);
    await user.save();

    res.status(200).json({ success: true, message: 'איש הקשר הוסר בהצלחה' });
  } catch (error: any) {
    logger.error(`Remove user contact error: ${error.message}`);
    res.status(500).json({ success: false, error: 'שגיאה בהסרת איש קשר', message: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};