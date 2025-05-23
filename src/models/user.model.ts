import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type * as ms from 'ms';

interface IPreferences {
  language: string;
  theme: string;
  shoppingMode: {
    hideCheckedItems: boolean;
    sortBy: string;
  };
  defaultUnitPreferences: {
    [key: string]: string;
  };
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  lastLogin?: Date;
  preferences: IPreferences;
  favoriteItems: mongoose.Types.ObjectId[];
  contacts: mongoose.Types.ObjectId[];
  deviceTokens: string[];
  refreshTokens: string[];
  
  // מתודות
  matchPassword(enteredPassword: string): Promise<boolean>;
  getSignedJwtToken(): string;
  getRefreshToken(): string;
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: [true, 'נא להזין כתובת אימייל'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'נא להזין כתובת אימייל תקינה',
    ],
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: [true, 'נא להזין סיסמה'],
    minlength: 6,
    select: false,
  },
  name: {
    type: String,
    required: [true, 'נא להזין שם'],
    trim: true,
  },
  avatar: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
  },
  preferences: {
    language: {
      type: String,
      default: 'he',
    },
    theme: {
      type: String,
      default: 'light',
    },
    shoppingMode: {
      hideCheckedItems: {
        type: Boolean,
        default: true,
      },
      sortBy: {
        type: String,
        default: 'category',
      },
    },
    defaultUnitPreferences: {
      type: Map,
      of: String,
      default: {},
    },
  },
  favoriteItems: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  deviceTokens: [String],
  refreshTokens: {
    type: [String],
    default: [],
  },
});

// Hook לפני שמירה - הצפנת סיסמה
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// מתודה להשוואת סיסמה
UserSchema.methods.matchPassword = async function (enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// מתודה ליצירת JWT
UserSchema.methods.getSignedJwtToken = function (): string {
  const secret = process.env.JWT_SECRET as string;
  const options: jwt.SignOptions = {
    expiresIn: process.env.JWT_EXPIRE as ms.StringValue || '15m',
  };
  
  return jwt.sign(
    { id: this._id },
    secret,
    options
  );
};

// מתודה ליצירת Refresh Token
UserSchema.methods.getRefreshToken = async function () {
  // וודא שיש סוד refresh token
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET לא מוגדר');
  }

  const refreshToken = jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  // הגבל ל-5 טוקנים בלבד
  // הוסף את הטוקן החדש בתחילת המערך והסר את הישנים אם יש יותר מ-5
  this.refreshTokens.unshift(refreshToken);
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(0, 5); // שמור רק את 5 הטוקנים החדשים ביותר
  }
  await this.save();

  return refreshToken;
};

export default mongoose.model<IUser>('User', UserSchema);