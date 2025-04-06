import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import Product from '../models/product.model';

// טען משתני סביבה
dotenv.config();

async function importProducts() {
  try {
    // התחבר למסד הנתונים
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/shopping-list');
    console.log('התחברות למסד הנתונים הצליחה');

    // קרא את קובץ ה-JSON
    const jsonPath = path.join(__dirname, 'products_array.json');
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`הקובץ ${jsonPath} לא נמצא!`);
      process.exit(1);
    }
    
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const products = JSON.parse(rawData);
    
    console.log(`נמצאו ${products.length} מוצרים בקובץ`);

    // המר את הנתונים לפורמט המתאים למודל
    const formattedProducts = products.map((item: any) => ({
      barcode: item['ברקוד'] || undefined,
      name: item['שם'],
      description: '',
      price: item['מחיר'],
      priceHistory: item['מחיר'] ? [{ price: item['מחיר'], date: new Date() }] : [],
      category: {
        main: item['קטגוריה'] || 'לא ידוע',
        sub: item['תת_קטגוריה'] || undefined,
      },
      image: item['תמונה'] || undefined,
      defaultUnit: 'יח\'',
      availableUnits: ['יח\''],
      nutrition: {},
      tags: [],
      allergens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // הכנס את המוצרים למסד הנתונים
    const result = await Product.insertMany(formattedProducts);
    console.log(`${result.length} מוצרים הוכנסו בהצלחה למסד הנתונים`);
  } catch (error) {
    console.error('שגיאה:', error);
  } finally {
    // סגור את החיבור למסד הנתונים
    await mongoose.disconnect();
    console.log('החיבור למסד הנתונים נסגר');
  }
}

// הרץ את הפונקציה
importProducts();