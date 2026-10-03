import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';

interface CapturedQuoteRequest {
  signal: AbortSignal | null | undefined;
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
}

type QuoteTestWindow = typeof window & { quoteRequests: CapturedQuoteRequest[] };

function quote(amount: number) {
  return {
    id: `quote-${amount}`,
    sourceAsset: 'USDC',
    destinationAsset: 'XLM',
    rate: 2,
    fee: 0,
    slippage: 0,
    estimatedDestinationAmount: amount * 2,
    hops: ['USDC', 'XLM'],
  };
}

async function waitForQuoteRequests(page: Page, count: number): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => (window as QuoteTestWindow).quoteRequests.length))
    .toBe(count);
}

async function respondToQuote(
  page: Page,
  index: number,
  body: unknown,
  status = 200
): Promise<void> {
  await page.evaluate(
    ({ index, body, status }) => {
      const request = (window as QuoteTestWindow).quoteRequests[index];
      if (!request) throw new Error(`Missing quote request ${index}`);
      request.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      );
      return new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
    },
    { index, body, status }
  );
}

async function rejectQuote(page: Page, index: number): Promise<void> {
  await page.evaluate((index) => {
    const request = (window as QuoteTestWindow).quoteRequests[index];
    if (!request) throw new Error(`Missing quote request ${index}`);
    request.reject(new Error('Older quote request lost its connection'));
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );
  }, index);
}

function submitButton(page: Page) {
  return page.getByRole('button', { name: /Connect Wallet to Swap|Simulate \+ Submit Payment/ });
}

test.describe('Cross-asset quote lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const requests: CapturedQuoteRequest[] = [];
      (window as QuoteTestWindow).quoteRequests = requests;
      const originalFetch = window.fetch.bind(window);

      window.fetch = (input, init) => {
        const url = new URL(
          input instanceof Request ? input.url : input.toString(),
          window.location.href
        );
        if (url.pathname !== '/api/v1/payments/pathfind') return originalFetch(input, init);

        // Deliberately do not reject on abort: a server, cache, or transport
        // may complete obsolete work. The page must also ignore its result.
        return new Promise<Response>((resolve, reject) => {
          requests.push({ signal: init?.signal, resolve, reject });
        });
      };
    });
    await page.goto('/cross-asset-payment');
    await expect(
      page.getByRole('heading', { name: 'Cross-Asset Payment Settlement' })
    ).toBeVisible();
  });

  test('distinguishes unavailable quotes from a successful empty result', async ({ page }) => {
    await page.getByLabel('Amount to Send').fill('100');
    await waitForQuoteRequests(page, 1);
    await respondToQuote(page, 0, { error: 'Not Found' }, 404);

    await expect(page.getByRole('alert')).toContainText('Quotes unavailable');
    await expect(page.getByRole('heading', { name: 'Settlement Preview' })).toBeHidden();
    await expect(submitButton(page)).toBeDisabled();

    await page.getByLabel('Amount to Send').fill('200');
    await waitForQuoteRequests(page, 2);
    await respondToQuote(page, 1, { paths: [] });

    await expect(
      page.getByText('No conversion paths are available for this asset pair and amount.')
    ).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(submitButton(page)).toBeDisabled();
  });

  for (const field of ['amount', 'source', 'destination'] as const) {
    test(`invalidates a successful quote immediately when ${field} changes`, async ({ page }) => {
      await page.getByLabel('Amount to Send').fill('100');
      await waitForQuoteRequests(page, 1);
      await respondToQuote(page, 0, { paths: [quote(100)] });
      await expect(page.getByRole('heading', { name: 'Settlement Preview' })).toBeVisible();
      await expect(submitButton(page)).toBeEnabled();

      if (field === 'amount') await page.getByLabel('Amount to Send').fill('200');
      if (field === 'source')
        await page.getByLabel('Send Asset', { exact: true }).selectOption('XLM');
      if (field === 'destination') await page.getByLabel('Receive Asset').selectOption('NGN');

      // No new response has been supplied: a previous quote must not remain
      // usable during either the debounce or the replacement request.
      await expect(submitButton(page)).toBeDisabled();
      await expect(page.getByRole('heading', { name: 'Settlement Preview' })).toBeHidden();
      await expect(page.getByText('Fetching conversion paths...')).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(() => (window as QuoteTestWindow).quoteRequests[0]?.signal?.aborted)
        )
        .toBe(true);
    });
  }

  test('does not resurrect a quote after editing away from and back to its amount', async ({
    page,
  }) => {
    await page.getByLabel('Amount to Send').fill('100');
    await waitForQuoteRequests(page, 1);
    await respondToQuote(page, 0, { paths: [quote(100)] });
    await expect(submitButton(page)).toBeEnabled();

    await page.getByLabel('Amount to Send').fill('200');
    await page.getByLabel('Amount to Send').fill('100');
    await expect(submitButton(page)).toBeDisabled();
    await expect(page.getByRole('heading', { name: 'Settlement Preview' })).toBeHidden();

    await waitForQuoteRequests(page, 2);
    await respondToQuote(page, 1, { paths: [quote(100)] });
    await expect(submitButton(page)).toBeEnabled();
  });

  test('ignores an older success after the current request fails', async ({ page }) => {
    await page.getByLabel('Amount to Send').fill('100');
    await waitForQuoteRequests(page, 1);
    await page.getByLabel('Amount to Send').fill('200');
    await waitForQuoteRequests(page, 2);
    await respondToQuote(page, 1, { error: 'Service unavailable' }, 503);
    await expect(page.getByRole('alert')).toContainText('Quotes unavailable');

    await respondToQuote(page, 0, { paths: [quote(100)] });
    await expect(page.getByRole('alert')).toContainText('Quotes unavailable');
    await expect(page.getByRole('heading', { name: 'Settlement Preview' })).toBeHidden();
    await expect(submitButton(page)).toBeDisabled();
  });

  test('ignores an older failure after a current successful quote', async ({ page }) => {
    await page.getByLabel('Amount to Send').fill('100');
    await waitForQuoteRequests(page, 1);
    await page.getByLabel('Amount to Send').fill('200');
    await waitForQuoteRequests(page, 2);
    await respondToQuote(page, 1, { paths: [quote(200)] });
    await expect(page.getByText('400 XLM', { exact: true })).toBeVisible();
    await expect(submitButton(page)).toBeEnabled();

    await rejectQuote(page, 0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('400 XLM', { exact: true })).toBeVisible();
    await expect(submitButton(page)).toBeEnabled();
  });
});
