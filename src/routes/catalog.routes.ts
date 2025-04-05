import express from 'express';
import * as catalogController from '../controllers/catalog.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// כל הנתיבים מוגנים
router.use(protect);

// נתיבי חיפוש וקטלוג
router.get('/', catalogController.searchCatalog);
router.get('/categories', catalogController.getCategories);
router.get('/categories/:id', catalogController.getSubcategories);
router.get('/products/:id', catalogController.getProduct);
router.get('/barcode/:code', catalogController.getProductByBarcode);
router.put('/products/:id/price', catalogController.updateProductPrice);

export default router;