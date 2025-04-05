import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model';
import logger from '../utils/logger';
import mongoose from 'mongoose';

// @desc    הרשמת משתמש חדש
// @route   POST /api/auth/register
// @access  ציבורי
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
      res.status(400).json({ success: false, error: 'כתובת האימייל כבר קיימת במערכת' });
      return;
    }

    const user = await User.create({
      email,
      passwordHash: password,
      name,
      createdAt: new Date(),
    });

    sendTokenResponse(user, 201, res);
    return;
  } catch (error: any) {
    logger.error(`Registration error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהרשמה',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    כניסת משתמש
// @route   POST /api/auth/login
// @access  ציבורי
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'נא לספק כתובת אימייל וסיסמה' });
      return;
    }

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      res.status(401).json({ success: false, error: 'פרטי התחברות שגויים' });
      return;
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'פרטי התחברות שגויים' });
      return;
    }

    user.lastLogin = new Date();
    await user.save();

    sendTokenResponse(user, 200, res);
    return;
  } catch (error: any) {
    logger.error(`Login error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהתחברות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    חידוש access token
// @route   POST /api/auth/refresh
// @access  ציבורי
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'חסר refresh token' });
      return;
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as jwt.JwtPayload;
    if (!decoded || !decoded.id) {
      res.status(401).json({ success: false, error: 'Refresh token לא תקף' });
      return;
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      res.status(401).json({ success: false, error: 'Refresh token לא תקף' });
      return;
    }

    const accessToken = generateToken((user._id as mongoose.Types.ObjectId).toString(), process.env.JWT_SECRET as string, (process.env.JWT_EXPIRE || '15m') as jwt.SignOptions['expiresIn']);

    res.status(200).json({ success: true, accessToken });
    return;
  } catch (error: any) {
    logger.error(`Refresh token error: ${error.message}`);
    res.status(401).json({
      success: false,
      error: 'Refresh token לא תקף או פג תוקף',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    ניתוק משתמש
// @route   POST /api/auth/logout
// @access  פרטי
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'חסר refresh token' });
      return;
    }

    const user = req.user;
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((token: string) => token !== refreshToken);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'נותקת בהצלחה' });
    return;
  } catch (error: any) {
    logger.error(`Logout error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בניתוק',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    קבלת פרטי המשתמש
// @route   GET /api/auth/me
// @access  פרטי
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    res.status(200).json({ success: true, data: user });
    return;
  } catch (error: any) {
    logger.error(`Get user error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת נתוני משתמש',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

const generateToken = (id: string, secret: string, expiresIn: jwt.SignOptions['expiresIn']): string => {
  return jwt.sign({ id }, secret, { expiresIn });
};

const sendTokenResponse = (user: any, statusCode: number, res: Response): void => {
  const accessToken = generateToken(
    user._id.toString(),
    process.env.JWT_SECRET as string,
    (process.env.JWT_EXPIRE || '15m') as jwt.SignOptions['expiresIn']
  );
  const refreshToken = user.getRefreshToken();
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