import { Router } from 'express';
import * as SearchController from '../controllers/search.controller';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/doctors', requireAuth, SearchController.searchDoctors);
router.get('/appointments', requireAuth, SearchController.searchAppointments);
router.get('/invoices', requireAuth, SearchController.searchInvoices);

router.get('/global', requireAuth, SearchController.globalSearch);
router.get('/suggestions', requireAuth, SearchController.getSearchSuggestions);
router.get('/history', requireAuth, SearchController.getSearchHistory);

export default router;