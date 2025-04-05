import request from 'supertest';
import { app } from '../../app';
import { clearDatabase, createTestUser, createTestCategories, createTestProduct } from '../helpers/db.helper';
import mongoose from 'mongoose';
import Product from '../../models/product.model';
import Category from '../../models/category.model';

describe('Catalog Controller Tests', () => {
  let token: string;
  
  beforeEach(async () => {
    // נקה את מסד הנתונים לפני כל בדיקה
    await clearDatabase();
    
    // צור קטגוריות בסיסיות
    await createTestCategories();
    
    // צור משתמש וקבל טוקן
    const { user, password } = await createTestUser();
    
    // התחבר לקבלת טוקן
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: password
      });
    
    token = loginResponse.body.accessToken;
  });
  
  describe('GET /api/catalog', () => {
    beforeEach(async () => {
      // צור מוצרים לבדיקות
      await createTestProduct({
        name: 'חלב 3%',
        barcode: '7290000000001',
        category: {
          main: 'dairy',
          sub: 'milk'
        },
        price: 6.90,
        tags: ['חלב', 'מוצרי חלב']
      });
      
      await createTestProduct({
        name: 'לחם אחיד',
        barcode: '7290000000002',
        category: {
          main: 'bakery',
          sub: 'bread'
        },
        price: 7.50,
        tags: ['לחם', 'מאפים']
      });
      
      await createTestProduct({
        name: 'קוטג\' 5%',
        barcode: '7290000000003',
        category: {
          main: 'dairy',
          sub: 'cheese'
        },
        price: 5.90,
        tags: ['גבינה', 'מוצרי חלב']
      });
    });
    
    it('should search catalog by text query', async () => {
      const response = await request(app)
        .get('/api/catalog?q=חלב')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('חלב 3%');
    });
    
    it('should search catalog by barcode', async () => {
      const response = await request(app)
        .get('/api/catalog?q=7290000000002')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('לחם אחיד');
    });
    
    it('should filter catalog by category', async () => {
      const response = await request(app)
        .get('/api/catalog?category=dairy')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      
      // בדוק שכל התוצאות הן מקטגוריית מוצרי חלב
      for (const product of response.body.data) {
        expect(product.category.main).toBe('dairy');
      }
    });
    
    it('should support pagination', async () => {
      // צור עוד מוצרים
      for (let i = 0; i < 10; i++) {
        await createTestProduct({
          name: `מוצר נוסף ${i}`,
          category: {
            main: 'produce'
          }
        });
      }
      
      // בדוק עמוד ראשון עם 5 תוצאות
      const response1 = await request(app)
        .get('/api/catalog?limit=5&page=1')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response1.status).toBe(200);
      expect(response1.body.data).toHaveLength(5);
      expect(response1.body.pagination).toBeDefined();
      expect(response1.body.pagination.page).toBe(1);
      expect(response1.body.pagination.limit).toBe(5);
      
      // בדוק עמוד שני
      const response2 = await request(app)
        .get('/api/catalog?limit=5&page=2')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response2.status).toBe(200);
      expect(response2.body.data).toHaveLength(5);
      expect(response2.body.pagination.page).toBe(2);
    });
    
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/catalog?q=חלב');
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/catalog/categories', () => {
    it('should get all main categories', async () => {
      const response = await request(app)
        .get('/api/catalog/categories')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // בדוק שכל הקטגוריות שהוחזרו הן קטגוריות ראשיות
      for (const category of response.body.data) {
        expect(category.parent).toBeNull();
      }
      
      // בדוק שהקטגוריות המוכרות נמצאות
      const categoryNames = response.body.data.map((cat: any) => cat.code);
      expect(categoryNames).toContain('produce');
      expect(categoryNames).toContain('dairy');
    });
  });
  
  describe('GET /api/catalog/categories/:id', () => {
    it('should get subcategories for a specific category', async () => {
      const response = await request(app)
        .get('/api/catalog/categories/produce')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // בדוק שכל התוצאות הן תת-קטגוריות של הקטגוריה הנבחרת
      for (const category of response.body.data) {
        expect(category.parent).toBe('produce');
      }
      
      // בדוק שהתת-קטגוריות המוכרות נמצאות
      const subcategoryNames = response.body.data.map((cat: any) => cat.code);
      expect(subcategoryNames).toContain('vegetables');
      expect(subcategoryNames).toContain('fruits');
    });
    
    it('should handle non-existent category', async () => {
      const response = await request(app)
        .get('/api/catalog/categories/nonexistent')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצאה');
    });
  });
  
  describe('GET /api/catalog/products/:id', () => {
    let productId: string;
    
    beforeEach(async () => {
      // צור מוצר לבדיקות
      const product = await createTestProduct({
        name: 'מוצר לבדיקה',
        price: 12.50,
        category: {
          main: 'produce',
          sub: 'vegetables'
        }
      });
      
      productId = product._id;
    });
    
    it('should get a specific product by ID', async () => {
      const response = await request(app)
        .get(`/api/catalog/products/${productId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id).toBe(productId);
      expect(response.body.data.name).toBe('מוצר לבדיקה');
      expect(response.body.data.price).toBe(12.50);
      
      // בדוק שמדד הפופולריות עודכן
      const updatedProduct = await Product.findById(productId);
      expect(updatedProduct!.popularity).toBe(1);
    });
    
    it('should handle non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/catalog/products/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצא');
    });
  });
  
  describe('GET /api/catalog/barcode/:code', () => {
    beforeEach(async () => {
      // צור מוצר עם ברקוד
      await createTestProduct({
        name: 'מוצר עם ברקוד',
        barcode: '7290123456789',
        price: 15.90,
        category: {
          main: 'produce'
        }
      });
    });
    
    it('should find a product by barcode', async () => {
      const response = await request(app)
        .get('/api/catalog/barcode/7290123456789')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe('מוצר עם ברקוד');
      expect(response.body.data.barcode).toBe('7290123456789');
      
      // בדוק שמדד הפופולריות עודכן
      const updatedProduct = await Product.findOne({ barcode: '7290123456789' });
      expect(updatedProduct!.popularity).toBe(1);
    });
    
    it('should handle non-existent barcode', async () => {
      const response = await request(app)
        .get('/api/catalog/barcode/9999999999999')
        .set('Authorization', `Bearer ${token}`);
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('לא נמצא מוצר');
    });
  });
  
  describe('PUT /api/catalog/products/:id/price', () => {
    let productId: string;
    
    beforeEach(async () => {
      // צור מוצר לבדיקות
      const product = await createTestProduct({
        name: 'מוצר לעדכון מחיר',
        price: 9.90,
        category: {
          main: 'produce'
        }
      });
      
      productId = product._id;
    });
    
    it('should update product price', async () => {
      const newPrice = 12.50;
      const supermarket = 'שופרסל';
      
      const response = await request(app)
        .put(`/api/catalog/products/${productId}/price`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: newPrice, supermarket });
      
      // בדוק תגובה מוצלחת
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.price).toBe(newPrice);
      
      // בדוק שהמחיר התעדכן והתווסף להיסטוריה
      const updatedProduct = await Product.findById(productId);
      expect(updatedProduct!.price).toBe(newPrice);
      expect(updatedProduct!.priceHistory).toHaveLength(1);
      expect(updatedProduct!.priceHistory[0].price).toBe(newPrice);
      expect(updatedProduct!.priceHistory[0].supermarket).toBe(supermarket);
    });
    
    it('should require a valid price', async () => {
      const response = await request(app)
        .put(`/api/catalog/products/${productId}/price`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 'invalid-price' });
      
      // בדוק תגובת שגיאה
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('מחיר תקף');
    });
    
    it('should not add to price history if price hasn\'t changed', async () => {
      // עדכן מחיר פעם ראשונה
      await request(app)
        .put(`/api/catalog/products/${productId}/price`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 15.0, supermarket: 'שופרסל' });
      
      // עדכן לאותו מחיר פעם נוספת
      const response = await request(app)
        .put(`/api/catalog/products/${productId}/price`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 15.0, supermarket: 'שופרסל' });
      
      // בדוק שהמחיר התעדכן אבל לא נוסף להיסטוריה פעם נוספת
      const updatedProduct = await Product.findById(productId);
      expect(updatedProduct!.price).toBe(15.0);
      expect(updatedProduct!.priceHistory).toHaveLength(1);
    });
  });
});