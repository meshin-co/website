import type { Page } from '@playwright/test';

export const RUM_ENDPOINT = 'https://cloudflareinsights.com/cdn-cgi/rum*';

export async function answerTheAnalyticsBeacon(page: Page) {
  await page.route(RUM_ENDPOINT, (route) =>
    route.fulfill({
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
      body: '',
    })
  );
}
