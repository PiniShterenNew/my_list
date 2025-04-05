import mongoose, { Types } from 'mongoose';
import User from '../../models/user.model';
import List from '../../models/list.model';
import ListItem from '../../models/listItem.model';
import Product from '../../models/product.model';
import Category from '../../models/category.model';
import bcrypt from 'bcrypt';

/**
 * מנקה את כל האוספים במסד הנתונים
 */
export const clearDatabase = async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
};

/**
 * מייצר משתמש לצורך בדיקות
 */
export const createTestUser = async (
  overrides: Partial<any> = {}
) => {
  // הצפן את הסיסמה
  const password = overrides.password || 'password123';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  // צור משתמש חדש
  const user = await User.create({
    email: `test${Date.now()}@example.com`,
    passwordHash,
    name: 'משתמש בדיקה',
    avatar: 'https://example.com/avatar.jpg',
    createdAt: new Date(),
    preferences: {
      language: 'he',
      theme: 'light',
      shoppingMode: {
        hideCheckedItems: true,
        sortBy: 'category'
      }
    },
    ...overrides
  });
  
  // החזר את המשתמש והסיסמה המקורית
  const userObj = user.toObject({ getters: true });
  return { 
    user: {
      ...userObj,
      _id: (user._id as mongoose.Types.ObjectId).toString()// וודא ש-_id הוא מחרוזת
    }, 
    password 
  };
};

/**
 * מייצר רשימת קניות לצורך בדיקות
 */
export const createTestList = async (
  userId: mongoose.Types.ObjectId | string,
  overrides: Partial<any> = {}
) => {
  const list = await List.create({
    name: 'רשימת בדיקה',
    description: 'תיאור רשימת בדיקה',
    type: 'oneTime',
    owner: userId,
    status: 'active',
    categoriesUsed: [],
    sharedWith: [],
    history: [
      {
        action: 'create',
        userId,
        timestamp: new Date(),
        details: { name: 'רשימת בדיקה' }
      }
    ],
    tags: ['test'],
    ...overrides
  });
  
  const listObj = list.toObject({ getters: true });
  return {
    ...listObj,
    _id: (list._id as mongoose.Types.ObjectId).toString()
  };
};

/**
 * מייצר פריט ברשימה לצורך בדיקות
 */
export const createTestListItem = async (
  listId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  overrides: Partial<any> = {}
) => {
  const item = await ListItem.create({
    listId,
    name: 'פריט בדיקה',
    category: {
      main: 'produce',
      sub: 'vegetables'
    },
    quantity: 1,
    unit: 'יח\'',
    isPermanent: false,
    isChecked: false,
    addedBy: userId,
    ...overrides
  });
  
  const itemObj = item.toObject({ getters: true });
  return {
    ...itemObj,
    _id: (item._id as mongoose.Types.ObjectId).toString()
  };
};

/**
 * מייצר מוצר בקטלוג לצורך בדיקות
 */
export const createTestProduct = async (
  overrides: Partial<any> = {}
) => {
  const product = await Product.create({
    name: 'מוצר בדיקה',
    barcode: `test${Date.now()}`,
    description: 'תיאור מוצר בדיקה',
    price: 9.90,
    category: {
      main: 'produce',
      sub: 'vegetables'
    },
    defaultUnit: 'יח\'',
    availableUnits: ['יח\'', 'ק"ג'],
    tags: ['test'],
    priceHistory: [],
    allergens: [],
    ...overrides
  });
  
  const productObj = product.toObject({ getters: true });
  return {
    ...productObj,
    _id: (product._id as mongoose.Types.ObjectId).toString()
  };
};

/**
 * מייצר קטגוריות בסיסיות לצורך בדיקות
 */
export const createTestCategories = async () => {
  const categories = [
    {
      code: 'produce',
      name: 'פירות וירקות',
      icon: '🥦',
      color: '#A5D6A7',
      parent: null,
      subCategories: ['vegetables', 'fruits'],
      defaultUnits: ['ק"ג', 'גרם', 'יח\''],
      customOrder: 1
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
      code: 'dairy',
      name: 'מוצרי חלב',
      icon: '🥛',
      color: '#90CAF9',
      parent: null,
      subCategories: ['milk', 'cheese'],
      defaultUnits: ['קרטון', 'חבילה', 'יח\''],
      customOrder: 2
    }
  ];
  
  return await Category.insertMany(categories);
};