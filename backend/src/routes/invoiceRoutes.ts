import { Router } from 'express';
import { invoiceController } from '../controllers/invoiceController.js';
import authenticateJWT from '../middlewares/auth.js';
import { authorizeRoles } from '../middlewares/rbac.js';

const router = Router();

// Apply authentication to all invoice routes
router.use(authenticateJWT);

// Contractor routes
router.post('/', authorizeRoles('CONTRACTOR'), (req, res) => invoiceController.createInvoice(req, res));
router.get('/my-invoices', authorizeRoles('CONTRACTOR'), (req, res) => invoiceController.getMyInvoices(req, res));

// Employer routes
router.get('/approved', authorizeRoles('EMPLOYER'), (req, res) => invoiceController.getApprovedInvoices(req, res));
router.get('/:id', authorizeRoles('EMPLOYER', 'CONTRACTOR'), (req, res) => invoiceController.getInvoiceById(req, res));
router.patch('/:id/review', authorizeRoles('EMPLOYER'), (req, res) => invoiceController.reviewInvoice(req, res));
router.get('/:id/pdf', authorizeRoles('EMPLOYER', 'CONTRACTOR'), (req, res) => invoiceController.downloadInvoicePDF(req, res));

// Must be last to avoid conflicts with specific routes
router.get('/', authorizeRoles('EMPLOYER'), (req, res) => invoiceController.getAllInvoices(req, res));

export default router;
