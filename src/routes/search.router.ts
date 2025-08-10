import { Router } from 'express';
import * as SearchController from '../controllers/search.controller';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/search/doctors', requireAuth, SearchController.searchDoctors);
router.get('/search/appointments', requireAuth, SearchController.searchAppointments);
router.get('/search/invoices', requireAuth, SearchController.searchInvoices);

router.get('/search/global', requireAuth, SearchController.globalSearch);
router.get('/search/suggestions', requireAuth, SearchController.getSearchSuggestions);
router.get('/search/history', requireAuth, SearchController.getSearchHistory);

export default router;