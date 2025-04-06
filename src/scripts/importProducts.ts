

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const productModel = require('../models/product.model.ts');

const jsonPath = path.join(__dirname, 'products_array.json'); // נתיב לקובץ JSON שלך
const rawData = fs.readFileSync(jsonPath, 'utf-8');
const products = JSON.parse(rawData);
console.log(products);
// async function run() {
//   try {
//     await mongoose.connect('mongodb://localhost:27017/shopping-list'); // שנה לפי הצורך
    
    
//     const formatted = products.map((item: any) => ({
//       barcode: item['ברקוד'] || undefined,
//       name: item['שם'],
//       description: '',
//       price: item['מחיר'],
//       priceHistory: item['מחיר']
//         ? [
//             {
//               price: item['מחיר'],
//               date: new Date(),
//             },
//           ]
//         : [],
//       category: {
//         main: item['קטגוריה'] || 'לא ידוע',
//         sub: item['תת_קטגוריה'] || undefined,
//       },
//       image: item['תמונה'] || undefined,
//       defaultUnit: 'יח\'',
//       availableUnits: ['יח\''],
//       nutrition: {},
//       tags: [],
//       allergens: [],
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     }));

//     const result = await productModel.insertMany(formatted);
//     console.log(`הוזנו ${result.length} מוצרים בהצלחה`);
//     process.exit(0);
//   } catch (err) {
//     console.error('שגיאה בהכנסת מוצרים:', err);
//     process.exit(1);
//   }
// }

// run();
