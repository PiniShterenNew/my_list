import express from 'express';
import * as userController from '../controllers/user.controller';
import { protect } from '../middlewares/auth.middleware';

const router = express.Router();

// כל הנתיבים מוגנים
router.use(protect);

// נתיבי פרופיל משתמש
router.get('/me', userController.getUserProfile);
router.put('/me', userController.updateUserProfile);
router.put('/me/preferences', userController.updateUserPreferences);

// נתיבי חיפוש וניהול אנשי קשר
router.get('/search', userController.searchUsers);
router.get('/contacts', userController.getUserContacts);
router.post('/contacts', userController.addUserContact);
router.delete('/contacts/:id', userController.removeUserContact);

export default router;