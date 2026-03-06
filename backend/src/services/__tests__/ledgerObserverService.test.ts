import { LedgerObserverService } from '../ledgerObserverService';
import { StellarService } from '../stellarService';
import { pool } from '../../config/database';
import axios from 'axios';

jest.mock('@stellar/stellar-sdk', () => {
    return {
        ServerApi: {},
        Horizon: {
            Server: jest.fn().mockImplementation(() => ({
                payments: jest.fn().mockReturnThis(),
                cursor: jest.fn().mockReturnThis(),
                stream: jest.fn()
            }))
        }
    };
});

jest.mock('axios');
jest.mock('../../config/database', () => ({
    pool: {
        query: jest.fn(),
    },
}));
jest.mock('../stellarService');

describe('LedgerObserverService', () => {
    let originalConsoleLog: any;
    let originalConsoleError: any;

    beforeAll(() => {
        // Suppress console outputs for clean test runs
        originalConsoleLog = console.log;
        originalConsoleError = console.error;
        console.log = jest.fn();
        console.error = jest.fn();
    });

    afterAll(() => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset internal state
        LedgerObserverService.stop();
        (LedgerObserverService as any).trackedAddresses.clear();
    });

    describe('Address Tracking', () => {
        it('should fetch and cache organization and employee addresses', async () => {
            const mockOrgQuery = { rows: [{ id: 1, wallet_address: 'G_ORG_1' }] };
            const mockEmpQuery = { rows: [{ organization_id: 1, wallet_address: 'G_EMP_1' }] };

            (pool.query as jest.Mock)
                .mockResolvedValueOnce(mockOrgQuery)
                .mockResolvedValueOnce(mockEmpQuery);

            await (LedgerObserverService as any).refreshTrackedAddresses();

            const tracked = (LedgerObserverService as any).trackedAddresses;
            expect(tracked.size).toBe(2);
            expect(tracked.get('G_ORG_1')).toEqual({ address: 'G_ORG_1', organizationId: 1, type: 'organization' });
            expect(tracked.get('G_EMP_1')).toEqual({ address: 'G_EMP_1', organizationId: 1, type: 'employee' });
        });
    });

    describe('Event Handling', () => {
        beforeEach(() => {
            // Setup some tracked addresses directly for isolated testing
            const tracked = new Map();
            tracked.set('G_KNOWN_ORG', { address: 'G_KNOWN_ORG', organizationId: 99, type: 'organization' });
            (LedgerObserverService as any).trackedAddresses = tracked;

            (pool.query as jest.Mock).mockResolvedValue({
                rows: [{ config_value: JSON.stringify({ webhook_url: 'https://webhook.site/test' }) }]
            });
            (axios.post as jest.Mock).mockResolvedValue({ status: 200 });
        });

        it('should trigger webhook when payment "to" a tracked address is processed', async () => {
            const mockPayment = {
                id: '1234',
                transaction_hash: 'hash1',
                type: 'payment',
                asset_type: 'native',
                amount: '100.0',
                from: 'G_UNKNOWN',
                to: 'G_KNOWN_ORG'
            };

            await (LedgerObserverService as any).handlePaymentEvent(mockPayment);

            expect(pool.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT config_value FROM tenant_configurations'),
                [99]
            );
            expect(axios.post).toHaveBeenCalledTimes(1);
            expect(axios.post).toHaveBeenCalledWith(
                'https://webhook.site/test',
                expect.objectContaining({
                    event_type: 'stellar_payment',
                    address: 'G_KNOWN_ORG',
                    amount: '100.0'
                }),
                expect.any(Object)
            );
        });

        it('should not trigger webhook if addresses are not tracked', async () => {
            const mockPayment = {
                id: '1234',
                transaction_hash: 'hash1',
                type: 'payment',
                from: 'G_UNKNOWN_1',
                to: 'G_UNKNOWN_2'
            };

            await (LedgerObserverService as any).handlePaymentEvent(mockPayment);

            expect(axios.post).not.toHaveBeenCalled();
        });
    });

    describe('Webhook Dispatch Retry', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            (pool.query as jest.Mock).mockResolvedValue({
                rows: [{ config_value: JSON.stringify({ webhook_url: 'https://webhook.site/fail' }) }]
            });
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('should retry failed webhooks up to MAX_RETRIES', async () => {
            (axios.post as jest.Mock).mockRejectedValue(new Error('Network Error'));

            // Initial trigger (synchronous error handled, starts timer for retry 1)
            const promise = (LedgerObserverService as any).dispatchWebhook(99, { event: 'test' });
            await promise;
            expect(axios.post).toHaveBeenCalledTimes(1);

            // Retry 1: Wait 1s
            jest.advanceTimersByTime(1000);
            await Promise.resolve(); // Allow the promise to execute
            await Promise.resolve(); // Allow the catch block to schedule next timer
            expect(axios.post).toHaveBeenCalledTimes(2);

            // Retry 2: Wait 2s
            jest.advanceTimersByTime(2000);
            await Promise.resolve();
            await Promise.resolve();
            expect(axios.post).toHaveBeenCalledTimes(3);

            // Retry 3: Wait 4s
            jest.advanceTimersByTime(4000);
            await Promise.resolve();
            await Promise.resolve();
            expect(axios.post).toHaveBeenCalledTimes(4);

            // Max retries reached, should not schedule another
            jest.advanceTimersByTime(8000);
            await Promise.resolve();
            expect(axios.post).toHaveBeenCalledTimes(4);
        });
    });
});
