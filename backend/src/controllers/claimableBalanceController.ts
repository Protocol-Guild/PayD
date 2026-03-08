import type { Request, Response } from 'express';
import { z } from 'zod';
import { ClaimableBalanceService } from '../services/claimableBalanceService.js';

const createForEmployeeSchema = z.object({
  organizationId: z.number().int().positive(),
  employeeId: z.number().int().positive(),
  amount: z.string().min(1),
  assetIssuer: z.string().length(56),
});

const listPendingSchema = z.object({
  organizationId: z.string().regex(/^\d+$/).transform(Number).optional(),
  walletAddress: z.string().length(56),
});

export class ClaimableBalanceController {
  static async createForEmployee(req: Request, res: Response) {
    try {
      const { organizationId, employeeId, amount, assetIssuer } = createForEmployeeSchema.parse(
        req.body
      );

      const wallet = await ClaimableBalanceService.ensureCustodialWallet({
        organizationId,
        employeeId,
      });

      const claim = await ClaimableBalanceService.createOrgUsdClaimableBalance({
        organizationId,
        employeeId,
        amount,
        assetIssuer,
        claimantPublicKey: wallet.publicKey,
      });

      res.status(201).json({
        success: true,
        data: {
          ...claim,
          claimantPublicKey: wallet.publicKey,
          instructions:
            'A claimable balance was created for your custodial wallet. Add the ORGUSD trustline, then claim the balance using your wallet application.',
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      res.status(500).json({ error: (error as Error).message || 'Failed to create claimable balance' });
    }
  }

  static async listPendingForWallet(req: Request, res: Response) {
    try {
      const { organizationId, walletAddress } = listPendingSchema.parse(req.query);

      const claims = await ClaimableBalanceService.listPendingClaimsForWallet({
        organizationId: organizationId ?? null,
        walletAddress,
      });

      res.json({ success: true, data: claims });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: error.issues });
      }
      res.status(500).json({ error: (error as Error).message || 'Failed to list pending claims' });
    }
  }
}
