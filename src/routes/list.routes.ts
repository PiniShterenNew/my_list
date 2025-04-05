import express from 'express';
import * as listController from '../controllers/list.controller';
import * as listItemController from '../controllers/listItem.controller';
import { protect, checkListPermission } from '../middlewares/auth.middleware';

const router = express.Router();

// כל הנתיבים מוגנים
router.use(protect);

// נתיבי רשימות
router.get('/', listController.getLists);
router.post('/', listController.createList);
router.get('/shared', listController.getSharedLists);

// נתיבים ספציפיים לרשימה
router.get('/:id', checkListPermission('view'), listController.getList);
router.put('/:id', checkListPermission('edit'), listController.updateList);
router.delete('/:id', checkListPermission('admin'), listController.deleteList);
router.put('/:id/status', checkListPermission('edit'), listController.updateListStatus);

// נתיבי שיתוף
router.post('/:id/share', checkListPermission('admin'), listController.shareList);
router.delete('/:id/share/:userId', checkListPermission('admin'), listController.removeListShare);

// נתיב לסיום קנייה
router.post('/:id/complete', checkListPermission('edit'), listController.completeShoppingList);

// נתיבי פריטים ברשימה
router.get('/:id/items', checkListPermission('view'), listItemController.getListItems);
router.post('/:id/items', checkListPermission('edit'), listItemController.addListItem);
router.put('/:id/items/:itemId', checkListPermission('edit'), listItemController.updateListItem);
router.delete('/:id/items/:itemId', checkListPermission('edit'), listItemController.deleteListItem);
router.put('/:id/items/:itemId/check', checkListPermission('view'), listItemController.toggleListItemCheck);

export default router;