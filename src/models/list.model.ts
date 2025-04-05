import mongoose, { Document, Schema } from 'mongoose';

interface IHistoryItem {
  action: string;
  userId: mongoose.Types.ObjectId;
  timestamp: Date;
  details?: Record<string, any>;
}

interface ISharedWith {
  userId: mongoose.Types.ObjectId;
  permissions: 'view' | 'edit' | 'admin';
  joinedAt: Date;
}

export interface IList extends Document {
  name: string;
  description?: string;
  type: 'permanent' | 'oneTime';
  createdAt: Date;
  lastModified: Date;
  owner: mongoose.Types.ObjectId;
  sharedWith: ISharedWith[];
  categoriesUsed: string[];
  status: 'active' | 'shopping' | 'completed';
  history: IHistoryItem[];
  shoppingFrequency?: number;
  tags: string[];
}

const ListSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'נא להזין שם לרשימה'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['permanent', 'oneTime'],
    default: 'oneTime',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastModified: {
    type: Date,
    default: Date.now,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sharedWith: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      permissions: {
        type: String,
        enum: ['view', 'edit', 'admin'],
        default: 'view',
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  categoriesUsed: [String],
  status: {
    type: String,
    enum: ['active', 'shopping', 'completed'],
    default: 'active',
  },
  history: [
    {
      action: {
        type: String,
        required: true,
      },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      details: {
        type: Schema.Types.Mixed,
      },
    },
  ],
  shoppingFrequency: {
    type: Number,
  },
  tags: [String],
});

// וידוא שאותו משתמש לא משותף פעמיים
ListSchema.path('sharedWith').validate(function(value: any[]) {
  const userIds = value.map(share => share.userId.toString());
  const uniqueUserIds = new Set(userIds);
  return userIds.length === uniqueUserIds.size;
}, 'משתמש לא יכול להופיע יותר מפעם אחת ברשימת השיתוף');

// עדכון lastModified בכל שמירה
ListSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// אינדקסים
ListSchema.index({ owner: 1 });
ListSchema.index({ 'sharedWith.userId': 1 });
ListSchema.index({ status: 1 });
ListSchema.index({ tags: 1 });

export default mongoose.model<IList>('List', ListSchema);