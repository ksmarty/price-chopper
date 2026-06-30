import { test, expect } from '@playwright/test';

test('Morning After - CSS is inlined via font proxy', async ({ page }) => {
	await page.goto('/go?url=' + encodeURIComponent('https://www.themorningafterto.com/brunch-lunch-menu'), { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForTimeout(8000);

	const iframe = page.frame({ url: /\/api\/proxy/ });
	if (!iframe) { test.fail(); return; }

	const info = await iframe.evaluate(() => {
		const links = document.querySelectorAll('link[rel="stylesheet"], link[rel="preload"][as="style"]');
		const styles = document.querySelectorAll('style');
		const processed = document.querySelectorAll('style[data-fp-processed]');
		const firstText = document.body.querySelector('h1, h2, h3, p, .sqs-block-content, .menu-item-title');
		return {
			links: links.length,
			styles: styles.length,
			processed: processed.length,
			fontFamily: firstText ? getComputedStyle(firstText).fontFamily : null,
			bg: getComputedStyle(document.body).backgroundColor,
		};
	});

	console.log(JSON.stringify(info, null, 2));

	// Verify page is styled (CSS was correctly inlined and applied)
	expect(info.fontFamily).not.toBe('sans-serif');
	expect(info.bg).not.toBe('rgba(0, 0, 0, 0)');

	await page.screenshot({ path: 'tests/output/morning-after.png', fullPage: true });
});
