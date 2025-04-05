import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'share' | 'reminder' | 'system';
  message: string;
  relatedId?: mongoose.Types.ObjectId;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

const NotificationSchema: Schema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['share', 'reminder', 'system'],
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: [true, 'נא להזין הודעה'],
    trim: true,
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'refModel',
  },
  refModel: {
    type: String,
    enum: ['List', 'ListItem', 'User'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  actionUrl: {
    type: String,
  },
});

// סטטי מתודה ליצירת התראה
NotificationSchema.statics.createNotification = async function(
  userId: mongoose.Types.ObjectId,
  type: 'share' | 'reminder' | 'system',
  message: string,
  relatedId?: mongoose.Types.ObjectId,
  refModel?: string,
  actionUrl?: string
) {
  const notification = await this.create({
    userId,
    type,
    message,
    relatedId,
    refModel,
    actionUrl,
    timestamp: new Date(),
    read: false,
  });

  // כאן אפשר להוסיף קוד ששולח התראות דחיפה במידת הצורך

  return notification;
};

// אינדקסים
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.model<INotification & {
  createNotification: (
    userId: mongoose.Types.ObjectId,
    type: 'share' | 'reminder' | 'system',
    message: string,
    relatedId?: mongoose.Types.ObjectId,
    refModel?: string,
    actionUrl?: string
  ) => Promise<INotification>;
}>('Notification', NotificationSchema);