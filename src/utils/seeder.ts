import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import Category from '../models/category.model';
import User from '../models/user.model';
import logger from './logger';
import { connectDB } from '../config/db';

// טען הגדרות סביבה
dotenv.config();

// נתוני קטגוריות
const categoriesData = [
  {
    code: 'dairy',
    name: 'מוצרי חלב',
    icon: '🥛',
    color: '#90CAF9',
    parent: null,
    subCategories: ['milk', 'cheese', 'yogurt', 'butter'],
    defaultUnits: ['קרטון', 'חבילה', 'יח\'', 'גרם'],
    customOrder: 1
  },
  {
    code: 'milk',
    name: 'חלב',
    icon: '🥛',
    color: '#90CAF9',
    parent: 'dairy',
    subCategories: [],
    defaultUnits: ['קרטון', 'ליטר', 'מ"ל'],
    customOrder: 1
  },
  {
    code: 'cheese',
    name: 'גבינות',
    icon: '🧀',
    color: '#90CAF9',
    parent: 'dairy',
    subCategories: [],
    defaultUnits: ['חבילה', 'גרם', 'פרוסות'],
    customOrder: 2
  },
  {
    code: 'bakery',
    name: 'מאפים ולחם',
    icon: '🍞',
    color: '#FFCC80',
    parent: null,
    subCategories: ['bread', 'pastry'],
    defaultUnits: ['יח\'', 'פרוסות', 'כיכר'],
    customOrder: 2
  },
  {
    code: 'bread',
    name: 'לחם',
    icon: '🍞',
    color: '#FFCC80',
    parent: 'bakery',
    subCategories: [],
    defaultUnits: ['כיכר', 'פרוסות', 'יח\''],
    customOrder: 1
  },
  {
    code: 'produce',
    name: 'פירות וירקות',
    icon: '🥦',
    color: '#A5D6A7',
    parent: null,
    subCategories: ['vegetables', 'fruits'],
    defaultUnits: ['ק"ג', 'גרם', 'יח\''],
    customOrder: 3
  },
  {
    code: 'vegetables',
    name: 'ירקות',
    icon: '🥦',
    color: '#A5D6A7',
    parent: 'produce',
    subCategories: [],
    defaultUnits: ['ק"ג', 'גרם', 'יח\''],
    customOrder: 1
  },
  {
    code: 'fruits',
    name: 'פירות',
    icon: '🍎',
    color: '#A5D6A7',
    parent: 'produce',
    subCategories: [],
    defaultUnits: ['ק"ג', 'גרם', 'יח\''],
    customOrder: 2
  },
  {
    code: 'meat',
    name: 'בשר ודגים',
    icon: '🥩',
    color: '#EF9A9A',
    parent: null,
    subCategories: ['fresh_meat', 'fish', 'poultry'],
    defaultUnits: ['ק"ג', 'גרם', 'חבילה'],
    customOrder: 4
  },
  {
    code: 'pantry',
    name: 'מזווה',
    icon: '🥫',
    color: '#FFD54F',
    parent: null,
    subCategories: ['canned', 'pasta', 'rice', 'oils', 'spices'],
    defaultUnits: ['יח\'', 'חבילה', 'קופסה'],
    customOrder: 5
  },
  {
    code: 'beverages',
    name: 'משקאות',
    icon: '🥤',
    color: '#81D4FA',
    parent: null,
    subCategories: ['soda', 'water', 'juice', 'coffee_tea'],
    defaultUnits: ['בקבוק', 'פחית', 'ליטר', 'חבילה'],
    customOrder: 6
  },
  {
    code: 'frozen',
    name: 'קפואים',
    icon: '❄️',
    color: '#B3E5FC',
    parent: null,
    subCategories: ['frozen_meals', 'ice_cream', 'frozen_vegetables'],
    defaultUnits: ['חבילה', 'קופסה', 'יח\''],
    customOrder: 7
  },
  {
    code: 'personal_care',
    name: 'טיפוח ויופי',
    icon: '💄',
    color: '#F8BBD0',
    parent: null,
    subCategories: ['hygiene', 'cosmetics', 'hair_care'],
    defaultUnits: ['יח\'', 'חבילה', 'בקבוק'],
    customOrder: 8
  },
  {
    code: 'cleaning',
    name: 'ניקיון',
    icon: '🧹',
    color: '#B39DDB',
    parent: null,
    subCategories: ['laundry', 'cleaning_products', 'paper_goods'],
    defaultUnits: ['בקבוק', 'חבילה', 'יח\''],
    customOrder: 9
  },
  {
    code: 'baby',
    name: 'תינוקות',
    icon: '👶',
    color: '#CE93D8',
    parent: null,
    subCategories: ['diapers', 'baby_food', 'baby_care'],
    defaultUnits: ['חבילה', 'יח\'', 'קופסה'],
    customOrder: 10
  },
  {
    code: 'pets',
    name: 'חיות מחמד',
    icon: '🐾',
    color: '#BCAAA4',
    parent: null,
    subCategories: ['pet_food', 'pet_care'],
    defaultUnits: ['חבילה', 'יח\'', 'ק"ג'],
    customOrder: 11
  },
  {
    code: 'household',
    name: 'כלי בית',
    icon: '🏠',
    color: '#B0BEC5',
    parent: null,
    subCategories: ['kitchen', 'storage', 'disposable'],
    defaultUnits: ['יח\'', 'חבילה', 'סט'],
    customOrder: 12
  }
];

// משתמש אדמין לדוגמה
const adminUser = {
  email: 'admin@example.com',
  passwordHash: 'password123',
  name: 'מנהל מערכת',
  avatar: 'https://ui-avatars.com/api/?name=מנהל+מערכת&background=4CAF50&color=fff',
  preferences: {
    language: 'he',
    theme: 'light',
    shoppingMode: {
      hideCheckedItems: true,
      sortBy: 'category'
    },
    defaultUnitPreferences: {}
  }
};

// פונקציה להכנסת נתונים התחלתיים
const seedData = async () => {
  try {
    // התחבר למסד הנתונים
    await connectDB();
    
    // מחק את כל הנתונים הקיימים
    await Category.deleteMany({});
    logger.info('Categories cleared');
    
    // הכנס קטגוריות
    await Category.insertMany(categoriesData);
    logger.info(`${categoriesData.length} categories inserted`);
    
    // בדוק אם יש כבר משתמש אדמין
    const existingAdmin = await User.findOne({ email: adminUser.email });
    
    if (!existingAdmin) {
      // הצפן את הסיסמה
      const salt = await bcrypt.genSalt(10);
      adminUser.passwordHash = await bcrypt.hash(adminUser.passwordHash, salt);
      
      // צור משתמש אדמין
      await User.create(adminUser);
      logger.info('Admin user created');
    } else {
      logger.info('Admin user already exists');
    }
    
    logger.info('Data seeding completed');
    process.exit();
  } catch (error: any) {
    logger.error(`Data seeding error: ${error.message}`);
    process.exit(1);
  }
};

// הרץ את הפונקציה
seedData();