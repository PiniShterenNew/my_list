import { Request, Response } from 'express';
import Product from '../models/product.model';
import Category from '../models/category.model';
import logger from '../utils/logger';

// @desc    חיפוש במוצרי הקטלוג
// @route   GET /api/catalog
// @access  פרטי
export const searchCatalog = async (req: Request, res: Response) => {
  try {
    const { q: query, category, limit = 10, page = 1 } = req.query;
    
    // בנה את תנאי החיפוש
    const searchConditions: any = {};
    
    // אם יש חיפוש טקסטואלי
    if (query) {
      searchConditions.$or = [
        { name: { $regex: query, $options: 'i' } },
        { barcode: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
      ];
    }
    
    // אם יש סינון לפי קטגוריה
    if (category) {
      searchConditions['category.main'] = category;
    }
    
    // בצע את החיפוש
    const skip = (Number(page) - 1) * Number(limit);
    
    const products = await Product.find(searchConditions)
      .select('name barcode image category defaultUnit price')
      .sort({ popularity: -1 })
      .skip(skip)
      .limit(Number(limit));
    
    // קבל את מספר התוצאות הכולל
    const total = await Product.countDocuments(searchConditions);
    
    res.status(200).json({
      success: true,
      count: products.length,
      total,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      data: products,
    });
  } catch (error: any) {
    logger.error(`Search catalog error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בחיפוש בקטלוג',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    קבלת כל הקטגוריות
// @route   GET /api/catalog/categories
// @access  פרטי
export const getCategories = async (req: Request, res: Response) => {
  try {
    // מצא את כל הקטגוריות הראשיות
    const categories = await Category.find({ parent: null })
      .sort({ customOrder: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error: any) {
    logger.error(`Get categories error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת קטגוריות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    קבלת תת-קטגוריות
// @route   GET /api/catalog/categories/:id
// @access  פרטי
export const getSubcategories = async (req: Request, res: Response) => {
  try {
    const categoryCode = req.params.id;
    
    // מצא את הקטגוריה הראשית
    const category = await Category.findOne({ code: categoryCode });
    
    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'הקטגוריה לא נמצאה',
      });
    }
    
    // מצא את כל תתי-הקטגוריות
    const subcategories = await Category.find({ parent: categoryCode })
      .sort({ customOrder: 1, name: 1 });
    
    res.status(200).json({
      success: true,
      count: subcategories.length,
      data: subcategories,
    });
  } catch (error: any) {
    logger.error(`Get subcategories error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת תת-קטגוריות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    קבלת מוצר ספציפי
// @route   GET /api/catalog/products/:id
// @access  פרטי
export const getProduct = async (req: Request, res: Response) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'המוצר לא נמצא',
      });
    }
    
    // עדכן את מדד הפופולריות של המוצר
    product.popularity = (product.popularity || 0) + 1;
    await product.save();
    
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    logger.error(`Get product error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת מוצר',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    חיפוש מוצר לפי ברקוד
// @route   GET /api/catalog/barcode/:code
// @access  פרטי
export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const barcode = req.params.code;
    
    const product = await Product.findOne({ barcode });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'לא נמצא מוצר עם הברקוד המבוקש',
      });
    }
    
    // עדכן את מדד הפופולריות של המוצר
    product.popularity = (product.popularity || 0) + 1;
    await product.save();
    
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    logger.error(`Get product by barcode error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בחיפוש מוצר לפי ברקוד',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    עדכון מחיר מוצר
// @route   PUT /api/catalog/products/:id/price
// @access  פרטי
export const updateProductPrice = async (req: Request, res: Response) => {
  try {
    const { price, supermarket } = req.body;
    
    if (!price || isNaN(Number(price))) {
      return res.status(400).json({
        success: false,
        error: 'נא לספק מחיר תקף',
      });
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'המוצר לא נמצא',
      });
    }
    
    // הוסף את המחיר להיסטוריה
    const priceUpdated = product.addPriceToHistory(Number(price), supermarket);
    
    if (priceUpdated) {
      await product.save();
    }
    
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    logger.error(`Update product price error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בעדכון מחיר מוצר',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};