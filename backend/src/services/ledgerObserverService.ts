import { StellarService } from './stellarService';
import { pool } from '../config/database';
import axios from 'axios';
import { ServerApi } from '@stellar/stellar-sdk/lib/horizon';

interface TrackedAddress {
    address: string;
    organizationId: number;
    type: 'organization' | 'employee';
}

export class LedgerObserverService {
    private static isRunning = false;
    private static closeStream: (() => void) | null = null;
    private static trackedAddresses: Map<string, TrackedAddress> = new Map();
    private static refreshInterval: NodeJS.Timeout | null = null;
    private static readonly MAX_WEBHOOK_RETRIES = 3;

    static async start() {
        if (this.isRunning) {
            console.log('LedgerObserverService is already running.');
            return;
        }

        console.log('Starting LedgerObserverService...');
        this.isRunning = true;

        // Fetch initial addresses
        await this.refreshTrackedAddresses();

        // Set up periodic refresh (every 5 minutes)
        this.refreshInterval = setInterval(async () => {
            await this.refreshTrackedAddresses();
        }, 5 * 60 * 1000);

        // Start listening to the network
        this.startStream();
    }

    static stop() {
        console.log('Stopping LedgerObserverService...');
        if (this.closeStream) {
            this.closeStream();
            this.closeStream = null;
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.isRunning = false;
    }

    private static async refreshTrackedAddresses() {
        try {
            const newTrackedAddresses = new Map<string, TrackedAddress>();

            // 1. Fetch Organization Addresses (Tenant Configs or Organizations table if multi-tenant)
            // Assuming an organizations table exists with stellar_address/wallet_address
            const orgQuery = `SELECT id, wallet_address FROM organizations WHERE wallet_address IS NOT NULL`;
            const orgResult = await pool.query(orgQuery);
            orgResult.rows.forEach(row => {
                newTrackedAddresses.set(row.wallet_address, {
                    address: row.wallet_address,
                    organizationId: row.id,
                    type: 'organization'
                });
            });

            // 2. Fetch Employee Addresses
            const empQuery = `SELECT organization_id, wallet_address FROM employees WHERE wallet_address IS NOT NULL AND status = 'active'`;
            const empResult = await pool.query(empQuery);
            empResult.rows.forEach(row => {
                newTrackedAddresses.set(row.wallet_address, {
                    address: row.wallet_address,
                    organizationId: row.organization_id,
                    type: 'employee'
                });
            });

            this.trackedAddresses = newTrackedAddresses;
            console.log(`[LedgerObserver] Tracked ${this.trackedAddresses.size} addresses.`);
        } catch (error) {
            console.error('[LedgerObserver] Failed to refresh tracked addresses:', error);
        }
    }

    private static startStream() {
        const server = StellarService.getServer();

        try {
            this.closeStream = server.payments()
                .cursor('now')
                .stream({
                    onmessage: (record) => {
                        // Type assertion since stream returns a generic record that we know is an operation
                        const payment = record as unknown as ServerApi.PaymentOperationRecord;
                        this.handlePaymentEvent(payment);
                    },
                    onerror: (error) => {
                        console.error('[LedgerObserver] Stream error:', error);
                        // Implement backoff or simple restart in production
                    }
                });
        } catch (error) {
            console.error('[LedgerObserver] Error starting stream:', error);
            this.isRunning = false;
        }
    }

    private static async handlePaymentEvent(payment: ServerApi.PaymentOperationRecord) {
        try {
            // Check if 'to' or 'from' is in our tracked addresses
            const involvedAddresses = new Set<string>();

            if (payment.source_account) involvedAddresses.add(payment.source_account);
            if ('to' in payment) involvedAddresses.add((payment as any).to);
            if ('from' in payment) involvedAddresses.add((payment as any).from);
            if ('funder' in payment) involvedAddresses.add((payment as any).funder);
            if ('account' in payment) involvedAddresses.add((payment as any).account);
            if ('trustor' in payment) involvedAddresses.add((payment as any).trustor);

            for (const addr of involvedAddresses) {
                const tracked = this.trackedAddresses.get(addr);
                if (tracked) {
                    console.log(`[LedgerObserver] Relevant event detected for Org ${tracked.organizationId}: ${payment.type} (Tx: ${payment.transaction_hash})`);

                    // Construct payload
                    const payload = {
                        event_type: 'stellar_payment',
                        timestamp: new Date().toISOString(),
                        organization_id: tracked.organizationId,
                        address_type: tracked.type,
                        address: addr,
                        operation_id: payment.id,
                        transaction_hash: payment.transaction_hash,
                        type: payment.type,
                        asset: 'asset_type' in payment ? (payment as any).asset_type : 'native',
                        amount: 'amount' in payment ? (payment as any).amount : null,
                        from: 'from' in payment ? (payment as any).from : (payment as any).source_account,
                        to: 'to' in payment ? (payment as any).to : null
                    };

                    await this.dispatchWebhook(tracked.organizationId, payload);

                    // If one event matches multiple rules, we might want to just notify once per org.
                    break;
                }
            }
        } catch (error) {
            console.error('[LedgerObserver] Error processing event:', error);
        }
    }

    private static async dispatchWebhook(organizationId: number, payload: unknown, retryCount = 0) {
        try {
            // Fetch webhook URL directly from DB if tenant configurations exist or fallback to process.env
            let webhookUrl = process.env.DEFAULT_WEBHOOK_URL;

            try {
                const query = `SELECT config_value FROM tenant_configurations WHERE organization_id = $1 AND config_key = 'notification_settings'`;
                const result = await pool.query(query, [organizationId]);
                if (result.rows.length > 0 && result.rows[0].config_value) {
                    const settings = typeof result.rows[0].config_value === 'string'
                        ? JSON.parse(result.rows[0].config_value)
                        : result.rows[0].config_value;
                    if (settings.webhook_url) {
                        webhookUrl = settings.webhook_url;
                    }
                }
            } catch (dbErr) {
                // Table might not exist yet, fallback is already set
                console.log(`[LedgerObserver] Could not fetch tenant webhook configs, using default if available.`);
            }

            if (!webhookUrl) {
                // No webhook configured for this organization
                return;
            }

            console.log(`[LedgerObserver] Dispatching webhook to Org ${organizationId} at ${webhookUrl}`);

            await axios.post(webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'PayD-Ledger-Observer/1.0',
                    'X-PayD-Event': (payload as any).event_type
                },
                timeout: 5000 // 5 second timeout
            });

            console.log(`[LedgerObserver] Webhook delivered successfully to Org ${organizationId}`);

        } catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            console.error(`[LedgerObserver] Webhook delivery failed for Org ${organizationId}: ${errMessage}`);

            if (retryCount < this.MAX_WEBHOOK_RETRIES) {
                const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s...
                console.log(`[LedgerObserver] Retrying webhook in ${delay}ms (Attempt ${retryCount + 1}/${this.MAX_WEBHOOK_RETRIES})`);

                setTimeout(() => {
                    this.dispatchWebhook(organizationId, payload, retryCount + 1);
                }, delay);
            } else {
                console.error(`[LedgerObserver] Webhook max retries reached for Org ${organizationId}`);
                // In a true enterprise system, we might log this to a dead-letter queue or DB table here
            }
        }
    }
}

export default LedgerObserverService;
