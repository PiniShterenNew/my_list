import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import logger from '../utils/logger';

// @desc    הרשמת משתמש חדש
// @route   POST /api/auth/register
// @access  ציבורי
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // בדוק אם המשתמש כבר קיים
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({
        success: false,
        error: 'כתובת האימייל כבר קיימת במערכת',
      });
    }

    // צור משתמש חדש
    const user = await User.create({
      email,
      passwordHash: password, // יוצפן על ידי middleware לפני השמירה
      name,
      createdAt: new Date(),
    });

    // צור וחזור את הטוקנים
    sendTokenResponse(user, 201, res);
  } catch (error: any) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהרשמה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    כניסת משתמש
// @route   POST /api/auth/login
// @access  ציבורי
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // וידוא שהמייל והסיסמה סופקו
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'נא לספק כתובת אימייל וסיסמה',
      });
    }

    // בדוק אם המשתמש קיים
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'פרטי התחברות שגויים',
      });
    }

    // בדוק אם הסיסמה תואמת
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'פרטי התחברות שגויים',
      });
    }

    // עדכן את תאריך ההתחברות האחרון
    user.lastLogin = new Date();
    await user.save();

    // צור וחזור את הטוקנים
    sendTokenResponse(user, 200, res);
  } catch (error: any) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהתחברות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    חידוש access token באמצעות refresh token
// @route   POST /api/auth/refresh
// @access  ציבורי (עם refresh token)
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'חסר refresh token',
      });
    }

    // וודא שה-refresh token תקף
    const decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as { id: string };

    // מצא את המשתמש
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'משתמש לא נמצא',
      });
    }

    // וודא שה-refresh token נמצא ברשימת הטוקנים של המשתמש
    if (!user.refreshTokens.includes(refreshToken)) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token לא תקף',
      });
    }

    // צור access token חדש
    const accessToken = user.getSignedJwtToken();

    res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (error: any) {
    logger.error(`Refresh token error: ${error.message}`);
    res.status(401).json({
      success: false,
      error: 'Refresh token לא תקף או פג תוקף',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    ניתוק משתמש וביטול refresh token
// @route   POST /api/auth/logout
// @access  פרטי
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'חסר refresh token',
      });
    }

    // מצא את המשתמש מבקשת האימות
    const user = req.user;

    // הסר את ה-refresh token מהמשתמש
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(
        (token: string) => token !== refreshToken
      );
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'נותקת בהצלחה',
    });
  } catch (error: any) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בניתוק',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    קבלת פרטי המשתמש המחובר כעת
// @route   GET /api/auth/me
// @access  פרטי
export const getMe = async (req: Request, res: Response) => {
  try {
    // המשתמש כבר נטען ב-middleware
    const user = req.user;

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    logger.error(`Get user error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת נתוני משתמש',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// פונקציית עזר לשליחת תגובת טוקנים
const sendTokenResponse = (user: any, statusCode: number, res: Response) => {
  // צור JWT
  const accessToken = user.getSignedJwtToken();
  
  // צור refresh token
  const refreshToken = user.getRefreshToken();

  // הכן את אובייקט המשתמש להחזרה (ללא שדות רגישים)
  const userData = {
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    preferences: user.preferences,
    createdAt: user.createdAt,
  };

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: userData,
  });
};