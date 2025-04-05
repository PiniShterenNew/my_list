import mongoose, { Document, Schema } from 'mongoose';

interface IPriceHistory {
  price: number;
  date: Date;
  supermarket?: string;
}

interface INutrition {
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

export interface IProduct extends Document {
  barcode?: string;
  name: string;
  description?: string;
  price?: number;
  priceHistory: IPriceHistory[];
  category: {
    main: string;
    sub?: string;
  };
  image?: string;
  defaultUnit: string;
  availableUnits: string[];
  nutrition?: INutrition;
  popularity?: number;
  tags: string[];
  allergens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
  barcode: {
    type: String,
    unique: true,
    sparse: true, // מאפשר ערכים ריקים
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'נא להזין שם מוצר'],
    trim: true,
    index: true,
  },
  description: {
    type: String,
    trim: true,
  },
  price: {
    type: Number,
  },
  priceHistory: [
    {
      price: {
        type: Number,
        required: true,
      },
      date: {
        type: Date,
        default: Date.now,
      },
      supermarket: {
        type: String,
      },
    },
  ],
  category: {
    main: {
      type: String,
      required: [true, 'נא לבחור קטגוריה ראשית'],
      index: true,
    },
    sub: {
      type: String,
      index: true,
    },
  },
  image: {
    type: String,
  },
  defaultUnit: {
    type: String,
    default: 'יח\'',
  },
  availableUnits: [String],
  nutrition: {
    calories: Number,
    protein: Number,
    fat: Number,
    carbs: Number,
  },
  popularity: {
    type: Number,
    default: 0,
  },
  tags: {
    type: [String],
    index: true,
  },
  allergens: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// עדכון תאריך עדכון בכל שמירה
ProductSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// פונקציה להוספת מחיר להיסטוריה
ProductSchema.methods.addPriceToHistory = function(price: number, supermarket?: string) {
  // בדוק אם המחיר שונה מהמחיר הנוכחי או אם מחיר עדכני כבר קיים מאותו סופרמרקט
  const currentPrice = this.price;
  const latestPriceForSupermarket = this.priceHistory
    .filter((entry: IPriceHistory) => !supermarket || entry.supermarket === supermarket)
    .sort((a: IPriceHistory, b: IPriceHistory) => b.date.getTime() - a.date.getTime())[0];

  // אם המחיר שונה או אין מחיר עדכני מאותו סופרמרקט, הוסף להיסטוריה
  if (currentPrice !== price || !latestPriceForSupermarket) {
    this.priceHistory.push({
      price,
      date: new Date(),
      supermarket,
    });
    this.price = price;
    return true;
  }
  return false;
};

// אינדקסים
ProductSchema.index({ barcode: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ popularity: -1 });

export default mongoose.model<IProduct>('Product', ProductSchema);