import { Request, Response } from 'express';
import Product from '../models/product.model';
import Category from '../models/category.model';
import logger from '../utils/logger';

// @desc    חיפוש במוצרי הקטלוג
// @route   GET /api/catalog
// @access  פרטי
export const searchCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q: query, category, limit = 10, page = 1 } = req.query;
    const searchConditions: any = {};

    if (query) {
      searchConditions.$or = [
        { name: { $regex: query, $options: 'i' } }, // חיפוש פשוט לפי תת-מחרוזת
        { barcode: { $regex: query, $options: 'i' } },
        { tags: { $in: [query] } }
      ];
    }

    if (category) {
      searchConditions['category.main'] = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const products = await Product.find(searchConditions)
      .select('name barcode image category defaultUnit price')
      .sort({ popularity: -1 })
      .skip(skip)
      .limit(Number(limit));

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
    return;
  } catch (error: any) {
    logger.error(`Search catalog error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בחיפוש בקטלוג',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    קבלת כל הקטגוריות
// @route   GET /api/catalog/categories
// @access  פרטי
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ parent: null })
      .sort({ customOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
    return;
  } catch (error: any) {
    logger.error(`Get categories error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת קטגוריות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    קבלת תת-קטגוריות
// @route   GET /api/catalog/categories/:id
// @access  פרטי
export const getSubcategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryCode = req.params.id;
    const category = await Category.findOne({ code: categoryCode });

    if (!category) {
      res.status(404).json({
        success: false,
        error: 'הקטגוריה לא נמצאה',
      });
      return;
    }

    const subcategories = await Category.find({ parent: categoryCode })
      .sort({ customOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: subcategories.length,
      data: subcategories,
    });
    return;
  } catch (error: any) {
    logger.error(`Get subcategories error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת תת-קטגוריות',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    קבלת מוצר ספציפי
// @route   GET /api/catalog/products/:id
// @access  פרטי
export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'המוצר לא נמצא',
      });
      return;
    }

    product.popularity = (product.popularity || 0) + 1;
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
    return;
  } catch (error: any) {
    logger.error(`Get product error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בקבלת מוצר',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    חיפוש מוצר לפי ברקוד
// @route   GET /api/catalog/barcode/:code
// @access  פרטי
export const getProductByBarcode = async (req: Request, res: Response): Promise<void> => {
  try {
    const barcode = req.params.code;
    const product = await Product.findOne({ barcode });

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'לא נמצא מוצר עם הברקוד המבוקש',
      });
      return;
    }

    product.popularity = (product.popularity || 0) + 1;
    await product.save();

    res.status(200).json({
      success: true,
      data: product,
    });
    return;
  } catch (error: any) {
    logger.error(`Get product by barcode error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'שגיאה בחיפוש מוצר לפי ברקוד',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
    return;
  }
};

// @desc    עדכון מחיר מוצר
// @route   PUT /api/catalog/products/:id/price
// @access  פרטי
// עדכון לפונקציה
export const updateProductPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { price, supermarket } = req.body;
    
    if (!price || isNaN(Number(price))) {
      res.status(400).json({
        success: false,
        error: 'נא לספק מחיר תקף',
      });
      return;
    }
    
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      res.status(404).json({
        success: false,
        error: 'המוצר לא נמצא',
      });
      return;
    }
    
    const newPrice = Number(price);

if (product.price !== newPrice) {
  product.price = newPrice;

  product.priceHistory.push({
    price: newPrice,
    supermarket,
    date: new Date(),
  });
}
    
    await product.save();
    
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error: any) {
    // טיפול בשגיאות...
  }
};
