import { Router } from 'express';
import { ClaimableBalanceController } from '../controllers/claimableBalanceController.js';

const router = Router();

router.post('/create-for-employee', ClaimableBalanceController.createForEmployee);
router.get('/pending', ClaimableBalanceController.listPendingForWallet);

export default router;
