import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

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

const UserSchema: Schema = new Schema({
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
  refreshTokens: [String],
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
    expiresIn: process.env.JWT_EXPIRE || '15m'
  };
  
  return jwt.sign(
    { id: this._id },
    secret,
    options
  );
};

// מתודה ליצירת Refresh Token
UserSchema.methods.getRefreshToken = function (): string {
  const secret = process.env.REFRESH_TOKEN_SECRET as string;
  const options: jwt.SignOptions = {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRE || '7d'
  };
  
  const refreshToken = jwt.sign(
    { id: this._id },
    secret,
    options
  );

  // שמור את הrefresh token במסד הנתונים
  this.refreshTokens = this.refreshTokens || [];
  
  // הגבל את מספר הrefresh tokens ל-5
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift(); // הסר את הטוקן הישן ביותר
  }
  
  this.refreshTokens.push(refreshToken);
  this.save();

  return refreshToken;
};

export default mongoose.model<IUser>('User', UserSchema);