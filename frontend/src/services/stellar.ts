import {
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  Asset,
  Claimant,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

export interface ClaimableBalanceDetails {
  id: string;
  source: string;
  claimant: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
}

export const generateWallet = () => {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getHorizonUrl(): string {
  const url =
    (import.meta.env.PUBLIC_STELLAR_HORIZON_URL as string | undefined) || 'http://localhost:8000';
  return normalizeBaseUrl(url);
}

function getNetworkPassphrase(): string {
  return (
    (import.meta.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE as string | undefined) ||
    'Standalone Network ; February 2017'
  );
}

export interface BuildClaimableBalanceInput {
  /** Public key of the employer account funding the payment (the connected wallet). */
  sourceAddress: string;
  claimantPublicKey: string;
  amount: string;
  assetCode?: string;
  assetIssuer?: string;
  horizonUrlOverride?: string;
}

/**
 * Builds a real, unsigned SEP-0010-independent claimable-balance transaction
 * XDR for the employer to review (simulate) and sign with their connected
 * wallet. Loads the employer's live sequence number from Horizon so the XDR
 * is submittable, not a placeholder.
 */
export async function buildClaimableBalanceXdr(input: BuildClaimableBalanceInput): Promise<string> {
  const horizonUrl = normalizeBaseUrl(input.horizonUrlOverride || getHorizonUrl());
  const server = new Horizon.Server(horizonUrl, { allowHttp: horizonUrl.startsWith('http://') });
  const account = await server.loadAccount(input.sourceAddress);

  const assetCode = input.assetCode || 'USDC';
  const asset =
    assetCode === 'XLM'
      ? Asset.native()
      : new Asset(assetCode, input.assetIssuer || input.sourceAddress);

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset,
        amount: input.amount,
        claimants: [
          new Claimant(
            input.claimantPublicKey,
            Claimant.predicateUnconditional() // Employee can claim whenever they want
          ),
        ],
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}
