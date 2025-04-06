import mongoose, { Document, Schema } from 'mongoose';

export interface IListItem extends Document {
  listId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId;
  name: string;
  category: {
    main: string;
    sub?: string;
  };
  quantity: number;
  unit: string;
  price?: number;
  isPermanent: boolean;
  isChecked: boolean;
  addedAt: Date;
  checkedAt?: Date;
  addedBy: mongoose.Types.ObjectId;
  customOrder?: number;
  notes?: string;
}

const ListItemSchema: Schema = new Schema({
  listId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'List',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  name: {
    type: String,
    required: [true, 'נא להזין שם מוצר'],
    trim: true,
  },
  category: {
    main: {
      type: String,
      // required: [true, 'נא לבחור קטגוריה ראשית'],
    },
    sub: {
      type: String,
    },
  },
  quantity: {
    type: Number,
    default: 1,
  },
  unit: {
    type: String,
    default: 'יח\'',
  },
  price: {
    type: Number,
  },
  isPermanent: {
    type: Boolean,
    default: false,
  },
  isChecked: {
    type: Boolean,
    default: false,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  checkedAt: {
    type: Date,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customOrder: {
    type: Number,
  },
  notes: {
    type: String,
  },
});

// פונקציה שמתבצעת לפני שמירת פריט - עדכון checkedAt
ListItemSchema.pre('save', function(next) {
  if (this.isModified('isChecked') && this.isChecked) {
    this.checkedAt = new Date();
  } else if (this.isModified('isChecked') && !this.isChecked) {
    this.checkedAt = undefined;
  }
  next();
});

// אינדקסים
ListItemSchema.index({ listId: 1, addedAt: -1 });
ListItemSchema.index({ listId: 1, 'category.main': 1 });
ListItemSchema.index({ listId: 1, isChecked: 1 });
ListItemSchema.index({ listId: 1, isPermanent: 1 });
ListItemSchema.index({ productId: 1 });

export default mongoose.model<IListItem>('ListItem', ListItemSchema);