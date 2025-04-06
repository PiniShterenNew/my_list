# מדריך אינטגרציה לפיתוח צד קדמי

מסמך זה מספק הנחיות מקיפות לפיתוח צד קדמי ואינטגרציה עם שרת הבקאנד של אפליקציית רשימות הקניות. המסמך מפרט את נקודות הקצה (endpoints) של ה-API, פורמט הנתונים, מנגנוני האימות, וכיצד להשתמש בהם נכון.

## תוכן עניינים

1. [ארכיטקטורת השרת](#ארכיטקטורת-השרת)
2. [מנגנון אימות והרשאות](#מנגנון-אימות-והרשאות)
3. [מודלי נתונים](#מודלי-נתונים)
4. [נקודות קצה (Endpoints)](#נקודות-קצה-endpoints)
5. [דוגמאות קוד](#דוגמאות-קוד)
6. [ניהול מצבים](#ניהול-מצבים)
7. [טיפול בשגיאות](#טיפול-בשגיאות)

## ארכיטקטורת השרת

השרת בנוי בארכיטקטורת REST API המבוססת על Node.js ו-Express. הוא משתמש במסד נתונים MongoDB עם Mongoose כ-ODM (Object Document Mapper).

### מבנה הפרויקט

```
src/
├── controllers/     # בקרים המטפלים בלוגיקה העסקית
├── models/          # מודלי מונגוס המגדירים את מבנה הנתונים
├── routes/          # הגדרת נתיבי ה-API
├── middlewares/     # מידלוורים כגון אימות ולוגים
├── services/        # שירותים כגון Socket.io
├── utils/           # כלים שימושיים
└── config/          # קבצי תצורה
```

### טכנולוגיות מרכזיות

- **Node.js & Express**: תשתית השרת
- **MongoDB & Mongoose**: מסד נתונים ו-ODM
- **JWT**: לאימות משתמשים
- **Socket.io**: לתקשורת בזמן אמת

## מנגנון אימות והרשאות

המערכת משתמשת במנגנון אימות מבוסס JWT (JSON Web Tokens) עם מערכת Refresh Token.

### תהליך האימות

1. **הרשמה/התחברות**: המשתמש מקבל Access Token ו-Refresh Token
2. **גישה למשאבים מוגנים**: שליחת Access Token בכותרת Authorization
3. **חידוש טוקן**: כאשר Access Token פג תוקף, יש להשתמש ב-Refresh Token לקבלת טוקן חדש

### כותרות בקשה

```
Authorization: Bearer <access_token>
```

### מחזור חיים של טוקנים

- **Access Token**: תוקף קצר (15 דקות כברירת מחדל)
- **Refresh Token**: תוקף ארוך (7 ימים)
- המערכת שומרת עד 5 Refresh Tokens למשתמש

## מודלי נתונים

### משתמש (User)

```typescript
interface IUser {
  email: string;           // כתובת אימייל (ייחודית)
  passwordHash: string;    // סיסמה מוצפנת
  name: string;            // שם המשתמש
  avatar?: string;         // URL לתמונת פרופיל
  createdAt: Date;         // תאריך יצירה
  lastLogin?: Date;        // תאריך התחברות אחרון
  preferences: {           // העדפות משתמש
    language: string;      // שפה (ברירת מחדל: 'he')
    theme: string;         // ערכת נושא (ברירת מחדל: 'light')
    shoppingMode: {        // מצב קניות
      hideCheckedItems: boolean;  // האם להסתיר פריטים מסומנים
      sortBy: string;      // מיון לפי (ברירת מחדל: 'category')
    };
    defaultUnitPreferences: { // העדפות יחידות מידה
      [key: string]: string;
    };
  };
  favoriteItems: ObjectId[];  // מוצרים מועדפים
  contacts: ObjectId[];       // אנשי קשר
  deviceTokens: string[];     // טוקנים למכשירים (להתראות)
  refreshTokens: string[];    // טוקני רענון
}
```

### רשימה (List)

```typescript
interface IList {
  name: string;            // שם הרשימה
  description?: string;    // תיאור
  type: 'permanent' | 'oneTime';  // סוג הרשימה
  createdAt: Date;         // תאריך יצירה
  lastModified: Date;      // תאריך עדכון אחרון
  owner: ObjectId;         // בעלים
  sharedWith: {            // משתמשים משותפים
    userId: ObjectId;      // מזהה משתמש
    permissions: 'view' | 'edit' | 'admin';  // הרשאות
    joinedAt: Date;        // תאריך הצטרפות
  }[];
  categoriesUsed: string[];  // קטגוריות בשימוש
  status: 'active' | 'shopping' | 'completed';  // סטטוס
  history: {               // היסטוריית פעולות
    action: string;        // סוג פעולה
    userId: ObjectId;      // מבצע הפעולה
    timestamp: Date;       // זמן ביצוע
    details?: Record<string, any>;  // פרטים נוספים
  }[];
  shoppingFrequency?: number;  // תדירות קניות
  tags: string[];          // תגיות
}
```

### פריט ברשימה (ListItem)

```typescript
interface IListItem {
  listId: ObjectId;        // מזהה הרשימה
  productId?: ObjectId;    // מזהה מוצר (אופציונלי)
  name: string;            // שם הפריט
  category: {              // קטגוריה
    main: string;          // קטגוריה ראשית
    sub?: string;          // תת-קטגוריה
  };
  quantity: number;        // כמות
  unit: string;            // יחידת מידה
  price?: number;          // מחיר
  isPermanent: boolean;    // האם פריט קבוע
  isChecked: boolean;      // האם סומן כנרכש
  addedAt: Date;           // תאריך הוספה
  checkedAt?: Date;        // תאריך סימון
  addedBy: ObjectId;       // מי הוסיף
  customOrder?: number;    // סדר מותאם אישית
  notes?: string;          // הערות
}
```

### מוצר (Product)

```typescript
interface IProduct {
  barcode?: string;        // ברקוד
  name: string;            // שם המוצר
  description?: string;    // תיאור
  price?: number;          // מחיר
  priceHistory: {          // היסטוריית מחירים
    price: number;         // מחיר
    date: Date;            // תאריך
    supermarket?: string;  // סופרמרקט
  }[];
  category: {              // קטגוריה
    main: string;          // קטגוריה ראשית
    sub?: string;          // תת-קטגוריה
  };
  image?: string;          // תמונה
  defaultUnit: string;     // יחידת מידה ברירת מחדל
  availableUnits: string[];  // יחידות מידה זמינות
  nutrition?: {            // ערכים תזונתיים
    calories?: number;     // קלוריות
    protein?: number;      // חלבון
    fat?: number;          // שומן
    carbs?: number;        // פחמימות
  };
  popularity?: number;     // פופולריות
  tags: string[];          // תגיות
  allergens: string[];     // אלרגנים
  createdAt: Date;         // תאריך יצירה
  updatedAt: Date;         // תאריך עדכון
}
```

### קטגוריה (Category)

```typescript
interface ICategory {
  code: string;            // קוד ייחודי
  name: string;            // שם הקטגוריה
  icon?: string;           // אייקון
  color?: string;          // צבע
  parent?: string;         // קטגוריית אב
  subCategories: string[]; // תת-קטגוריות
  defaultUnits: string[];  // יחידות מידה ברירת מחדל
  customOrder?: number;    // סדר מותאם אישית
}
```

### התראה (Notification)

```typescript
interface INotification {
  userId: ObjectId;        // מזהה משתמש
  type: 'share' | 'reminder' | 'system';  // סוג התראה
  message: string;         // הודעה
  relatedId?: ObjectId;    // מזהה ישות קשורה
  timestamp: Date;         // זמן
  read: boolean;           // האם נקראה
  actionUrl?: string;      // קישור לפעולה
}
```

## נקודות קצה (Endpoints)

### אימות (Auth)

| נתיב | שיטה | תיאור | פרמטרים | תגובה |
|------|------|-------|----------|--------|
| `/api/auth/register` | POST | הרשמת משתמש חדש | `{ email, password, name }` | `{ success, accessToken, refreshToken, user }` |
| `/api/auth/login` | POST | התחברות | `{ email, password }` | `{ success, accessToken, refreshToken, user }` |
| `/api/auth/refresh` | POST | חידוש טוקן | `{ refreshToken }` | `{ success, accessToken }` |
| `/api/auth/logout` | POST | ניתוק | `{ refreshToken }` | `{ success, message }` |
| `/api/auth/me` | GET | קבלת פרטי המשתמש | - | `{ success, data }` |

### משתמשים (Users)

| נתיב | שיטה | תיאור | פרמטרים | תגובה |
|------|------|-------|----------|--------|
| `/api/users/me` | GET | קבלת פרופיל משתמש | - | `{ success, data }` |
| `/api/users/me` | PUT | עדכון פרופיל | `{ name, avatar, ... }` | `{ success, data }` |
| `/api/users/me/preferences` | PUT | עדכון העדפות | `{ preferences }` | `{ success, data }` |
| `/api/users/search` | GET | חיפוש משתמשים | `?query=...` | `{ success, data }` |
| `/api/users/contacts` | GET | קבלת אנשי קשר | - | `{ success, data }` |
| `/api/users/contacts` | POST | הוספת איש קשר | `{ userId }` | `{ success, data }` |
| `/api/users/contacts/:id` | DELETE | הסרת איש קשר | - | `{ success, data }` |

### רשימות (Lists)

| נתיב | שיטה | תיאור | פרמטרים | תגובה |
|------|------|-------|----------|--------|
| `/api/lists` | GET | קבלת כל הרשימות | - | `{ success, data }` |
| `/api/lists` | POST | יצירת רשימה חדשה | `{ name, description, type, ... }` | `{ success, data }` |
| `/api/lists/shared` | GET | קבלת רשימות משותפות | - | `{ success, data }` |
| `/api/lists/:id` | GET | קבלת רשימה ספציפית | - | `{ success, data }` |
| `/api/lists/:id` | PUT | עדכון רשימה | `{ name, description, ... }` | `{ success, data }` |
| `/api/lists/:id` | DELETE | מחיקת רשימה | - | `{ success, data }` |
| `/api/lists/:id/status` | PUT | עדכון סטטוס רשימה | `{ status }` | `{ success, data }` |
| `/api/lists/:id/share` | POST | שיתוף רשימה | `{ userId, permissions }` | `{ success, data }` |
| `/api/lists/:id/share/:userId` | DELETE | ביטול שיתוף | - | `{ success, data }` |
| `/api/lists/:id/complete` | POST | סיום רשימת קניות | - | `{ success, data }` |

### פריטים ברשימה (List Items)

| נתיב | שיטה | תיאור | פרמטרים | תגובה |
|------|------|-------|----------|--------|
| `/api/lists/:id/items` | GET | קבלת פריטים ברשימה | - | `{ success, data }` |
| `/api/lists/:id/items` | POST | הוספת פריט לרשימה | `{ name, category, quantity, ... }` | `{ success, data }` |
| `/api/lists/:id/items/:itemId` | PUT | עדכון פריט | `{ name, quantity, ... }` | `{ success, data }` |
| `/api/lists/:id/items/:itemId` | DELETE | מחיקת פריט | - | `{ success, data }` |
| `/api/lists/:id/items/:itemId/check` | PUT | סימון/ביטול סימון פריט | `{ isChecked }` | `{ success, data }` |

### קטלוג (Catalog)

| נתיב | שיטה | תיאור | פרמטרים | תגובה |
|------|------|-------|----------|--------|
| `/api/catalog` | GET | חיפוש בקטלוג | `?query=...` | `{ success, data }` |
| `/api/catalog/categories` | GET | קבלת קטגוריות | - | `{ success, data }` |
| `/api/catalog/categories/:id` | GET | קבלת תת-קטגוריות | - | `{ success, data }` |
| `/api/catalog/products/:id` | GET | קבלת מוצר לפי מזהה | - | `{ success, data }` |
| `/api/catalog/barcode/:code` | GET | קבלת מוצר לפי ברקוד | - | `{ success, data }` |
| `/api/catalog/products/:id/price` | PUT | עדכון מחיר מוצר | `{ price, supermarket }` | `{ success, data }` |

### התראות (Notifications)

| נתיב | שיטה | תיאור | פרמטרים | תגובה |
|------|------|-------|----------|--------|
| `/api/notifications` | GET | קבלת התראות | - | `{ success, data }` |
| `/api/notifications/:id/read` | PUT | סימון התראה כנקראה | - | `{ success, data }` |
| `/api/notifications/read-all` | PUT | סימון כל ההתראות כנקראו | - | `{ success, data }` |
| `/api/notifications/:id` | DELETE | מחיקת התראה | - | `{ success, data }` |

## דוגמאות קוד

### הרשמת משתמש חדש

```javascript
async function registerUser(userData) {
  try {
    const response = await fetch('http://your-api-url/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      // שמירת הטוקנים בלוקל סטורג'
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } else {
      throw new Error(data.error || 'שגיאה בהרשמה');
    }
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}
```

### התחברות

```javascript
async function loginUser(credentials) {
  try {
    const response = await fetch('http://your-api-url/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });
    
    const data = await response.json();
    
    if (data.success) {
      // שמירת הטוקנים בלוקל סטורג'
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    } else {
      throw new Error(data.error || 'שגיאה בהתחברות');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

### ביצוע בקשה מאומתת

```javascript
async function fetchWithAuth(url, options = {}) {
  // קבלת הטוקן מהלוקל סטורג'
  const accessToken = localStorage.getItem('accessToken');
  
  // הוספת הטוקן לכותרות
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    // בדיקה אם הטוקן פג תוקף
    if (response.status === 401) {
      // ניסיון לחדש את הטוקן
      const newAccessToken = await refreshAccessToken();
      
      if (newAccessToken) {
        // ניסיון חוזר עם הטוקן החדש
        headers.Authorization = `Bearer ${newAccessToken}`;
        return fetch(url, {
          ...options,
          headers
        });
      }
    }
    
    return response;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  
  if (!refreshToken) {
    // אם אין refresh token, יש להפנות להתחברות מחדש
    redirectToLogin();
    return null;
  }
  
  try {
    const response = await fetch('http://your-api-url/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });
    
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('accessToken', data.accessToken);
      return data.accessToken;
    } else {
      // אם הרענון נכשל, יש להפנות להתחברות מחדש
      redirectToLogin();
      return null;
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    redirectToLogin();
    return null;
  }
}

function redirectToLogin() {
  // ניקוי הלוקל סטורג' והפניה לדף ההתחברות
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
```

### יצירת רשימה חדשה

```javascript
async function createNewList(listData) {
  try {
    const response = await fetchWithAuth('http://your-api-url/api/lists', {
      method: 'POST',
      body: JSON.stringify(listData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error || 'שגיאה ביצירת רשימה');
    }
  } catch (error) {
    console.error('Create list error:', error);
    throw error;
  }
}
```

### הוספת פריט לרשימה

```javascript
async function addItemToList(listId, itemData) {
  try {
    const response = await fetchWithAuth(`http://your-api-url/api/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error || 'שגיאה בהוספת פריט');
    }
  } catch (error) {
    console.error('Add item error:', error);
    throw error;
  }
}
```

## ניהול מצבים

### המלצות לניהול מצב בצד הלקוח

1. **שימוש בספריית ניהול מצב**: Redux, MobX, או Context API של React
2. **מבנה מצב מומלץ**:

```javascript
{
  auth: {
    isAuthenticated: boolean,
    user: Object,
    loading: boolean,
    error: string
  },
  lists: {
    items: Array,
    currentList: Object,
    loading: boolean,
    error: string
  },
  listItems: {
    items: Array,
    loading: boolean,
    error: string
  },
  catalog: {
    products: Array,
    categories: Array,
    loading: boolean,
    error: string
  },
  notifications: {
    items: Array,
    unreadCount: number,
    loading: boolean,
    error: string
  }
}
```

### עדכון מצב בזמן אמת

השרת תומך בעדכונים בזמן אמת באמצעות Socket.io. להלן דוגמה לחיבור:

```javascript
import io from 'socket.io-client';

function setupSocketConnection(accessToken) {
  const socket = io('http://your-api-url', {
    query: { token: accessToken }
  });
  
  socket.on('connect', () => {
    console.log('Socket connected');
  });
  
  socket.on('listUpdated', (data) => {
    // עדכון מצב הרשימה בצד הלקוח
    console.log('List updated:', data);
    // dispatch(updateList(data));
  });
  
  socket.on('itemAdded', (data) => {
    // הוספת פריט חדש למצב
    console.log('Item added:', data);
    // dispatch(addListItem(data));
  });
  
  socket.on('itemUpdated', (data) => {
    // עדכון פריט במצב
    console.log('Item updated:', data);
    // dispatch(updateListItem(data));
  });
  
  socket.on('itemRemoved', (data) => {
    // הסרת פריט מהמצב
    console.log('Item removed:', data);
    // dispatch(removeListItem(data));
  });
  
  socket.on('notification', (data) => {
    // הוספת התראה חדשה
    console.log('New notification:', data);
    // dispatch(addNotification(data));
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });
  
  return socket;
}
```

## טיפול בשגיאות

### קודי שגיאה נפוצים

| קוד | משמעות | טיפול מומלץ |
|-----|---------|-------------|
| 400 | בקשה שגויה | הצגת הודעת שגיאה למשתמש |
| 401 | לא מורשה | ניסיון לחדש את הטוקן, אם נכשל - הפניה להתחברות מחדש |
| 403 | אין הרשאה | הצגת הודעה שאין למשתמש הרשאה לפעולה זו |
| 404 | לא נמצא | הצגת הודעה שהמשאב לא נמצא |
| 500 | שגיאת שרת | הצגת הודעת שגיאה כללית והצעה לנסות שוב מאוחר יותר |

### דוגמה לטיפול בשגיאות

```javascript
async function handleApiRequest(apiCall, successCallback, errorCallback) {
  try {
    const data = await apiCall();
    if (successCallback) successCallback(data);
    return data;
  } catch (error) {
    console.error('API Error:', error);
    
    let errorMessage = 'אירעה שגיאה. נא לנסות שוב מאוחר יותר.';
    
    if (error.response) {
      // השרת הגיב עם קוד שגיאה
      switch (error.response.status) {
        case 400:
          errorMessage = error.response.data.error || 'הבקשה שגויה';
          break;
        case 401:
          // טופל כבר בפונקציית fetchWithAuth
          errorMessage = 'פג תוקף החיבור, נא להתחבר מחדש';
          break;
        case 403:
          errorMessage = 'אין לך הרשאה לבצע פעולה זו';
          break;
        case 404:
          errorMessage = 'המשאב המבוקש לא נמצא';
          break;
        case 500:
          errorMessage = 'שגיאת שרת. נא לנסות שוב מאוחר יותר';
          break;
      }
    }
    
    if (errorCallback) errorCallback(errorMessage);
    throw new Error(errorMessage);
  }