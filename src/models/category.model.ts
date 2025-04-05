import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  code: string;
  name: string;
  icon?: string;
  color?: string;
  parent?: string;
  subCategories: string[];
  defaultUnits: string[];
  customOrder?: number;
}

const CategorySchema: Schema = new Schema({
  code: {
    type: String,
    required: [true, 'נא להזין קוד קטגוריה'],
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'נא להזין שם קטגוריה'],
    trim: true,
  },
  icon: {
    type: String,
  },
  color: {
    type: String,
  },
  parent: {
    type: String,
    default: null,
    index: true,
  },
  subCategories: {
    type: [String],
    default: [],
  },
  defaultUnits: {
    type: [String],
    default: ['יח\''],
  },
  customOrder: {
    type: Number,
  },
});

// תפקוד לקבלת קטגוריות-משנה
CategorySchema.methods.getChildCategories = async function() {
  return await mongoose.model('Category').find({ parent: this.code });
};

// אינדקסים
CategorySchema.index({ code: 1 });
CategorySchema.index({ name: 1 });
CategorySchema.index({ customOrder: 1 });

export default mongoose.model<ICategory>('Category', CategorySchema);