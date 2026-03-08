import crypto from 'crypto';
import { Keypair, Asset, Operation, Claimant, StrKey, xdr } from '@stellar/stellar-sdk';
import pool from '../config/database.js';
import { StellarService } from './stellarService.js';

type EncryptionVersion = 1;

function getEncryptionKey(): Buffer {
  const key = process.env.CUSTODIAL_WALLET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('CUSTODIAL_WALLET_ENCRYPTION_KEY is not configured');
  }

  const asHex = /^[0-9a-fA-F]+$/.test(key) && key.length === 64;
  const buf = asHex ? Buffer.from(key, 'hex') : Buffer.from(key, 'base64');
  if (buf.length !== 32) {
    throw new Error('CUSTODIAL_WALLET_ENCRYPTION_KEY must be 32 bytes (hex-64 or base64)');
  }
  return buf;
}

function encryptSecret(secret: string): { encrypted: string; version: EncryptionVersion } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, ciphertext]).toString('base64');
  return { encrypted: payload, version: 1 };
}

function decryptSecret(encrypted: string): string {
  const key = getEncryptionKey();
  const raw = Buffer.from(encrypted, 'base64');

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function extractClaimableBalanceId(resultXdr: string): string | null {
  const txResult = xdr.TransactionResult.fromXDR(resultXdr, 'base64');
  const opResults = txResult.result().results();
  if (!opResults || opResults.length === 0) return null;

  for (const opResult of opResults) {
    const tr = opResult.tr();
    if (!tr) continue;

    const type = tr.value().switch().name;
    if (type !== 'createClaimableBalance') continue;

    const cb = (tr.value() as any).createClaimableBalanceResult?.().balanceId?.();
    if (!cb) continue;

    const raw = cb.v0();
    const balanceId = StrKey.encodeClaimableBalanceId(raw);
    return balanceId;
  }

  return null;
}

export class ClaimableBalanceService {
  static async ensureCustodialWallet(params: {
    organizationId: number;
    employeeId: number;
  }): Promise<{ walletId: string; publicKey: string; secretKey: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT w.id, w.wallet_address
         FROM wallets w
         WHERE w.organization_id = $1 AND w.employee_id = $2 AND w.wallet_type = 'employee' AND w.asset_code = 'XLM' AND w.asset_issuer = ''
         LIMIT 1`,
        [params.organizationId, params.employeeId]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        const secretResult = await client.query(
          'SELECT encrypted_secret FROM custodial_wallet_secrets WHERE wallet_id = $1',
          [row.id]
        );
        if (secretResult.rows.length === 0) {
          throw new Error('Custodial wallet exists without stored secret');
        }

        const secretKey = decryptSecret(secretResult.rows[0].encrypted_secret);

        await client.query('COMMIT');

        return { walletId: row.id, publicKey: row.wallet_address, secretKey };
      }

      const kp = Keypair.random();
      const enc = encryptSecret(kp.secret());

      const walletInsert = await client.query(
        `INSERT INTO wallets (
          organization_id,
          employee_id,
          wallet_address,
          wallet_type,
          asset_code,
          asset_issuer
        ) VALUES ($1, $2, $3, 'employee', 'XLM', '')
        RETURNING id, wallet_address`,
        [params.organizationId, params.employeeId, kp.publicKey()]
      );

      const wallet = walletInsert.rows[0];

      await client.query(
        `INSERT INTO custodial_wallet_secrets (wallet_id, encrypted_secret, encryption_version)
         VALUES ($1, $2, $3)`,
        [wallet.id, enc.encrypted, enc.version]
      );

      await client.query(
        `UPDATE employees
         SET wallet_address = COALESCE(wallet_address, $1), status = CASE WHEN status = 'active' THEN 'pending' ELSE status END
         WHERE id = $2 AND organization_id = $3`,
        [kp.publicKey(), params.employeeId, params.organizationId]
      );

      await client.query('COMMIT');

      return { walletId: wallet.id, publicKey: wallet.wallet_address, secretKey: kp.secret() };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  static async createOrgUsdClaimableBalance(params: {
    organizationId: number;
    employeeId: number;
    amount: string;
    assetIssuer: string;
    claimantPublicKey: string;
  }): Promise<{ claimId: string; balanceId: string; txHash: string }> {
    const sourceSecret = process.env.STELLAR_SOURCE_SECRET;
    if (!sourceSecret) {
      throw new Error('STELLAR_SOURCE_SECRET environment variable not set');
    }

    const sourceKeypair = Keypair.fromSecret(sourceSecret);

    const asset = new Asset('ORGUSD', params.assetIssuer);
    const claimant = new Claimant(params.claimantPublicKey, Claimant.predicateUnconditional());

    const op = Operation.createClaimableBalance({
      asset,
      amount: params.amount,
      claimants: [claimant],
    });

    const builder = await StellarService.buildTransaction(sourceKeypair.publicKey(), [op], {
      timeout: 30,
    });

    const tx = builder.build();
    const signed = StellarService.signTransaction(tx, sourceKeypair);
    const result = await StellarService.submitTransaction(signed);

    if (!result.success) {
      throw new Error('Failed to submit claimable balance transaction');
    }

    const balanceId = result.resultXdr ? extractClaimableBalanceId(result.resultXdr) : null;
    if (!balanceId) {
      throw new Error('Unable to extract claimable balance id from result XDR');
    }

    const insert = await pool.query(
      `INSERT INTO claimable_balance_claims (
        organization_id,
        employee_id,
        asset_code,
        asset_issuer,
        amount,
        status,
        stellar_balance_id,
        create_tx_hash
      ) VALUES ($1, $2, 'ORGUSD', $3, $4, 'pending', $5, $6)
      RETURNING id`,
      [params.organizationId, params.employeeId, params.assetIssuer, params.amount, balanceId, result.hash]
    );

    return {
      claimId: insert.rows[0].id,
      balanceId,
      txHash: result.hash,
    };
  }

  static async listPendingClaimsForWallet(params: {
    organizationId: number | null;
    walletAddress: string;
  }): Promise<
    Array<{
      id: string;
      employee_id: number | null;
      amount: string;
      asset_code: string;
      asset_issuer: string;
      stellar_balance_id: string | null;
      create_tx_hash: string | null;
      created_at: string;
      status: string;
    }>
  > {
    const result = await pool.query(
      `SELECT c.id, c.employee_id, c.amount, c.asset_code, c.asset_issuer, c.stellar_balance_id, c.create_tx_hash, c.created_at, c.status
       FROM claimable_balance_claims c
       JOIN employees e ON e.id = c.employee_id
       WHERE ($1::int IS NULL OR c.organization_id = $1)
         AND e.wallet_address = $2
         AND c.status = 'pending'
       ORDER BY c.created_at DESC`,
      [params.organizationId, params.walletAddress]
    );

    return result.rows;
  }
}
