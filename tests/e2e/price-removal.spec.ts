import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const CLIENT_SCRIPT = readFileSync(resolve('src/lib/client/price-remover.js'), 'utf-8');
const TEST_PAGE = readFileSync(resolve('tests/fixtures/test-prices.html'), 'utf-8');

let fixtureServer: { close: () => void; port: number } | null = null;

test.beforeAll(async () => {
	await new Promise<void>((resolveStart) => {
		const server = createServer((_req: IncomingMessage, res: ServerResponse) => {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(TEST_PAGE);
		});
		server.listen(0, () => {
			const addr = server.address();
			if (addr && typeof addr === 'object') {
				fixtureServer = { close: () => server.close(), port: addr.port };
			}
			resolveStart();
		});
	});
});

test.afterAll(() => {
	fixtureServer?.close();
});

function countDollarPrices(page: import('@playwright/test').Page) {
	return page.evaluate(() => {
		const results: string[] = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
		let node;
		while ((node = walker.nextNode())) {
			const p = node.parentNode;
			if (p) {
				const tag = (p as HTMLElement).tagName || '';
				if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'MATH') continue;
			}
			const m = (node.nodeValue || '').match(/\$\d+(?:\.\d{1,2})?/g);
			if (m) results.push(...m);
		}
		return results;
	});
}

function countWholeNumberPrices(page: import('@playwright/test').Page) {
	return page.evaluate(() => {
		const results: string[] = [];
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
		let node;
		while ((node = walker.nextNode())) {
			const p = node.parentNode;
			if (p) {
				const tag = (p as HTMLElement).tagName || '';
				if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'MATH') continue;
			}
			const text = node.nodeValue || '';
			const m = text.match(/(?<![.\d-])\b\d{2,3}\b(?=\s*(?:\/|$))/g);
			if (m) results.push(...m);
		}
		return results;
	});
}

test.describe('Price Removal', () => {
	test('client-side script replaces prices with spaces from static content', async ({ page }) => {
		await page.goto(`http://localhost:${fixtureServer!.port}/`);
		await page.waitForSelector('.menu-items');
		await page.waitForTimeout(200);

		const priceText = await page.textContent('.item:first-child .price');
		expect(priceText?.trim()).toBe('$18.95');

		await page.evaluate(CLIENT_SCRIPT);
		await page.waitForTimeout(200);

		const cleaned = await page.textContent('.item:first-child .price');
		expect(cleaned?.trim()).toBe('');
		expect(cleaned).not.toContain('$');
	});

	test('client-side script removes all dollar prices and handles attributes', async ({ page }) => {
		await page.goto(`http://localhost:${fixtureServer!.port}/`);
		await page.waitForSelector('.menu-items');
		await page.waitForTimeout(200);

		const pricesBefore = await countDollarPrices(page);
		expect(pricesBefore.length).toBeGreaterThanOrEqual(6);

		await page.evaluate(CLIENT_SCRIPT);
		await page.waitForTimeout(300);

		const pricesAfter = await countDollarPrices(page);
		expect(pricesAfter.length).toBe(0);
	});

	test('client-side script handles dynamically loaded content via MutationObserver', async ({ page }) => {
		await page.goto(`http://localhost:${fixtureServer!.port}/`);
		await page.waitForSelector('.menu-items');

		await page.evaluate(CLIENT_SCRIPT);
		await page.waitForTimeout(200);

		const dynamicPricesBefore = await page.evaluate(() => {
			const c = document.getElementById('dynamic-container');
			return c?.innerHTML.includes('item0-price') ? 'items-exist' : 'no-items';
		});
		expect(dynamicPricesBefore).toBe('no-items');

		await page.waitForSelector('.dynamic-item', { timeout: 5000 });
		await page.waitForTimeout(500);

		const dynamicPricesAfter = await page.evaluate(() => {
			const c = document.getElementById('dynamic-container');
			if (!c) return 'no-container';
			return c.innerHTML.includes('$32.00') ? 'price-found' : 'price-removed';
		});
		expect(dynamicPricesAfter).toBe('price-removed');
	});

	test('proxy injects client script into response', async ({ page }) => {
		const response = await page.request.get(
			`/api/proxy?url=${encodeURIComponent(`http://localhost:${fixtureServer!.port}/`)}&currency=auto`,
		);
		expect(response.ok()).toBeTruthy();

		const html = await response.text();

		expect(html).toContain('MutationObserver');
		expect(html).toContain('characterData');
		expect(html).toContain('function clean');
	});

	test('proxy page rendering removes prices after load', async ({ page }) => {
		await page.goto(
			`/api/proxy?url=${encodeURIComponent(`http://localhost:${fixtureServer!.port}/`)}&currency=auto`,
		);
		await page.waitForSelector('.menu-items');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1500);

		const pricesInDOM = await countDollarPrices(page);
		expect(pricesInDOM.length).toBe(0);

		await page.screenshot({ path: 'tests/output/proxy-browser-test.png', fullPage: true });
	});
});

test.describe('PDF Processing', () => {
	test('PDF upload renders preview without console errors', async ({ page }) => {
		test.setTimeout(30000);

		const errors: string[] = [];
		const failedReqs: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				errors.push(msg.text());
				console.log('CONSOLE ERROR:', msg.text());
			}
		});
		page.on('requestfailed', (req) => {
			failedReqs.push(`${req.url()} - ${req.failure()?.errorText}`);
			console.log('REQUEST FAILED:', req.url(), '-', req.failure()?.errorText);
		});

		// Upload the PDF via the home page
		await page.goto('/', { waitUntil: 'networkidle' });

		// Trigger file upload
		const fileChooserPromise = page.waitForEvent('filechooser');
		await page.getByRole('button', { name: 'Upload PDF' }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles(resolve('Example PDF.pdf'));

		// Wait for navigation to go page
		await page.waitForURL(/\/go/, { timeout: 15000 });
		await page.waitForTimeout(2000);

		// Check for any errors or failed requests
		const consoleErrors = errors.filter(
			(e) =>
				!e.includes('Failed to load resource: net::ERR_HTTP2_PROTOCOL_ERROR') &&
				!e.includes('ERR_BLOCKED_BY_ORB') &&
				!e.includes('The snipped is executed') &&
				!e.includes("Failed to read the 'cookie'") &&
				!e.includes('Failed to load resource: net::ERR_ABORTED'),
		);
		const requestErrors = failedReqs.filter(
			(r) =>
				!r.includes('ERR_HTTP2_PROTOCOL_ERROR') &&
				!r.includes('ERR_BLOCKED_BY_ORB') &&
				!r.includes('ERR_ABORTED'),
		);

		if (consoleErrors.length > 0) {
			console.log('Unexpected console errors:', consoleErrors);
		}
		if (requestErrors.length > 0) {
			console.log('Unexpected request failures:', requestErrors);
		}

		expect(consoleErrors).toEqual([]);
		expect(requestErrors).toEqual([]);

		// Verify the PDF viewer is showing
		const viewerText = await page.textContent('body');
		expect(viewerText).not.toContain('PDF renderer unavailable');
		expect(viewerText).not.toContain('Failed to upload');
	});
});

test.describe('Real Sites', () => {
	test('Gia Restaurant - removes $47 prefix and whole-number menu prices', async ({ page }) => {
		test.setTimeout(30000);

		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				console.log(`BROWSER CONSOLE ERROR: ${msg.text()}`);
			}
		});
		page.on('pageerror', (err) => {
			console.log(`BROWSER PAGE ERROR: ${err.message}`);
		});
		page.on('requestfailed', (req) => {
			console.log(`BROWSER REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText}`);
		});

		await page.goto(
			`/api/proxy?url=${encodeURIComponent('https://giarestaurant.ca/')}&currency=auto`,
			{ waitUntil: 'domcontentloaded', timeout: 20000 },
		);
		// Wait for the injected price-remover script to run its passes
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(8000);

		const pricesAfter = await countDollarPrices(page);
		const wholePricesAfter = await countWholeNumberPrices(page);

		if (pricesAfter.length > 0 || wholePricesAfter.length > 0) {
			console.log('Remaining $ prices on Gia:', pricesAfter);
			console.log('Remaining whole-number prices on Gia:', wholePricesAfter);
			const details = await page.evaluate(() => {
				const results: Array<{ text: string; tag: string; id: string; cls: string }> = [];
				const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
				let node;
				while ((node = walker.nextNode())) {
					const text = node.nodeValue || '';
					const m = text.match(/(?<![.\d-])\b\d{2,3}\b(?=\s*(?:\/|$))/g);
					if (m) {
						const p = node.parentNode;
						results.push({
							text: text.trim().substring(0, 120),
							tag: p ? (p as HTMLElement).tagName || '' : '',
							id: (p as HTMLElement)?.id || '',
							cls: (p as HTMLElement)?.className || '',
						});
					}
				}
				return results;
			});
			console.log('Details:', JSON.stringify(details, null, 2));
		}

		expect(pricesAfter.length).toBe(0);
		expect(wholePricesAfter.length).toBe(0);
		await page.screenshot({ path: 'tests/output/gia-cleaned.png', fullPage: true });
	});

	test('Terroni Adelaide - event prices removed', async ({ page, request }) => {
		test.setTimeout(30000);

		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				console.log(`BROWSER CONSOLE ERROR (Terroni): ${msg.text()}`);
			}
		});
		page.on('pageerror', (err) => {
			console.log(`BROWSER PAGE ERROR (Terroni): ${err.message}`);
		});
		page.on('requestfailed', (req) => {
			console.log(`BROWSER REQUEST FAILED (Terroni): ${req.url()} - ${req.failure()?.errorText}`);
		});

		const resp = await request.get(
			`/api/proxy?url=${encodeURIComponent('https://www.terroni.com/locations/terroni-adelaide')}&currency=auto`,
		);
		if (!resp.ok()) {
			console.log('Terroni proxy fetch failed, skipping test');
			return;
		}
		const html = await resp.text();
		await page.setContent(html, { timeout: 15000 });
		await page.waitForTimeout(8000);

		const pricesAfter = await countDollarPrices(page);

		if (pricesAfter.length > 0) {
			console.log('Remaining prices on Terroni:', pricesAfter);
		}

		expect(pricesAfter.length).toBe(0);
		await page.screenshot({ path: 'tests/output/terroni-cleaned.png', fullPage: true });
	});
});
