// @ts-nocheck
import * as cheerio from 'cheerio';

const CURRENCIES = {
	auto: { code: 'auto', symbol: '', name: 'Auto-detect', prefix: true, decimals: 2 },
	USD: { code: 'USD', symbol: '$', name: 'US Dollar', prefix: true, decimals: 2 },
	EUR: { code: 'EUR', symbol: '€', name: 'Euro', prefix: true, decimals: 2 },
	GBP: { code: 'GBP', symbol: '£', name: 'British Pound', prefix: true, decimals: 2 },
	JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', prefix: true, decimals: 0 },
	CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', prefix: true, decimals: 2 },
	AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', prefix: true, decimals: 2 },
};

function buildPriceRegexes(currencyCode) {
	const patterns = [];
	if (currencyCode === 'auto') {
		const entries = Object.entries(CURRENCIES).filter(([code]) => code !== 'auto');
		for (const [, curr] of entries) {
			const sym = curr.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			if (!sym) continue;
			if (curr.prefix) {
				patterns.push(new RegExp(`(?:,?\\s*)${sym}\\s*\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?`, 'gi'));
				patterns.push(new RegExp(`\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?\\s*,?\\s*${sym}`, 'gi'));
				if (curr.code) {
					patterns.push(
						new RegExp(`${curr.code}\\s*\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,${Math.max(curr.decimals, 2)}})?`, 'gi'),
					);
				}
			} else {
				patterns.push(new RegExp(`(?:,?\\s*)\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,${curr.decimals}})?\\s*${sym}`, 'gi'));
			}
		}
		patterns.push(
			/\b(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|BRL|KRW|SEK|NOK|DKK|NZD|MXN|SGD|HKD|TRY|PLN)\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/gi,
		);
		patterns.push(
			/\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|BRL|KRW|SEK|NOK|DKK|NZD|MXN|SGD|HKD|TRY|PLN)\b/gi,
		);
		patterns.push(/\b(?:was|now|only|just|from|starting at|as low as)\s*[$€£¥₹₩₺zł][\d,]+(?:\.\d{1,2})?\b/gi);
	} else {
		const curr = CURRENCIES[currencyCode];
		if (curr && curr.symbol) {
			const sym = curr.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			if (curr.prefix) {
				patterns.push(new RegExp(`(?:,?\\s*)${sym}\\s*\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,${curr.decimals}})?`, 'g'));
				patterns.push(new RegExp(`\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,${curr.decimals}})?\\s*,?\\s*${sym}`, 'g'));
			} else {
				patterns.push(new RegExp(`(?:,?\\s*)\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,${curr.decimals}})?\\s*${sym}`, 'g'));
			}
		}
	}
	return patterns;
}

function removePriceFromText(text, regexes) {
	let result = text;
	for (const regex of regexes) {
		result = result.replace(regex, '');
	}
	result = result
		.replace(/\s+,/g, ',')
		.replace(/,(\s*[.,!?;:])/g, '$1')
		.replace(/[,;:]+\s*$/, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([.,!?;:)])/g, '$1')
		.replace(/^\(\)\s*/g, '')
		.replace(/\s+$/g, '')
		.replace(/^\s+/g, '');
	return result;
}

function stripPrices(html, options) {
	const $ = cheerio.load(html, { xmlMode: false });
	const regexes = buildPriceRegexes(options.currency);
	let priceCount = 0;
	const textNodes = [];

	const walkTextNodes = (element) => {
		if (element && element.type === 'text') {
			const original = element.data || '';
			if (!original.trim()) return;
			const cleaned = removePriceFromText(original, regexes);
			if (cleaned !== original) {
				const matchCount = regexes.reduce((sum, r) => {
					const matches = original.match(r);
					return sum + (matches ? matches.length : 0);
				}, 0);
				priceCount += matchCount;
				textNodes.push({ node: element, newText: cleaned });
			}
			return;
		}
		if (element && element.type === 'tag') {
			const skip = new Set(['script', 'style', 'noscript', 'svg', 'math']);
			if (skip.has(element.name)) return;
			if (element.children) {
				for (const child of element.children) {
					walkTextNodes(child);
				}
			}
		}
	};

	const body = $('body');
	if (body.length) {
		for (const child of body[0].children) {
			walkTextNodes(child);
		}
	}

	for (const { node, newText } of textNodes) {
		node.data = newText;
	}

	const title = $('title').text() || 'Untitled';
	let cleaned = $.html();
	cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
	return { cleaned, title, priceCount };
}

function findPrices($, regexes) {
	const results = [];
	const walk = (el) => {
		if (el && el.type === 'text') {
			const text = el.data || '';
			if (!text.trim()) return;
			for (const regex of regexes) {
				const matches = text.match(regex);
				if (matches) {
					const parent = el.parent;
					const parentTag = parent?.name || 'unknown';
					const parentClass = parent?.attribs?.class || '';
					const context = text.trim().substring(0, 120).replace(/\n/g, ' ');
					results.push({ matches: matches.map((m) => m.trim()), context, parentTag, parentClass });
					break;
				}
			}
			return;
		}
		if (el && el.type === 'tag') {
			const skip = ['script', 'style', 'noscript', 'svg'];
			if (skip.includes(el.name)) return;
			if (el.children) {
				for (const child of el.children) {
					walk(child);
				}
			}
		}
	};
	const body = $('body');
	if (body.length) {
		for (const child of body[0].children) {
			walk(child);
		}
	}
	return results;
}

async function fetchPage(url) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			},
			redirect: 'follow',
		});
		return await response.text();
	} finally {
		clearTimeout(timeout);
	}
}

async function testUrl(testCase) {
	console.log(`\n${'='.repeat(70)}`);
	console.log(`🧪 Testing: ${testCase.name}`);
	console.log(`   URL: ${testCase.url}`);
	console.log(`${'='.repeat(70)}\n`);

	const html = await fetchPage(testCase.url);
	console.log(`📡 Fetched ${(html.length / 1024).toFixed(1)} KB\n`);

	const regexes = buildPriceRegexes(testCase.currency);
	const $ = cheerio.load(html);
	const priceMatches = findPrices($, regexes);

	console.log(`💰 Found ${priceMatches.length} price instances:\n`);
	if (priceMatches.length > 0) {
		const uniquePrices = [...new Set(priceMatches.flatMap((p) => p.matches))];
		console.log(
			`   Unique: ${uniquePrices.slice(0, 25).join(', ')}${uniquePrices.length > 25 ? `... (+${uniquePrices.length - 25})` : ''}\n`,
		);

		for (const p of priceMatches.slice(0, 10)) {
			console.log(`     [${p.matches.join(', ')}]`);
			console.log(`     "${p.context}"`);
			console.log(`     <${p.parentTag}>`);
			console.log();
		}
		if (priceMatches.length > 10) console.log(`   ... and ${priceMatches.length - 10} more`);
	}

	const result = stripPrices(html, { currency: testCase.currency });

	console.log(`✂️  Stripped:`);
	console.log(`   Price count: ${result.priceCount}`);
	console.log(`   Title: "${result.title}"`);

	const $clean = cheerio.load(result.cleaned);
	const remaining = findPrices($clean, regexes);
	console.log(`   Remaining: ${remaining.length}`);

	if (remaining.length > 0) {
		for (const p of remaining.slice(0, 5)) {
			console.log(`   ⚠️  NOT REMOVED: [${p.matches.join(', ')}] — "${p.context}"`);
		}
	}

	const linkCount = $clean('link').length;
	const scriptCount = $clean('script').length;
	const styleCount = $clean('style').length;
	const imgCount = $clean('img').length;
	console.log(`   Structure: ${linkCount} links, ${scriptCount} scripts, ${styleCount} styles, ${imgCount} images`);

	const hasClientScript = result.cleaned.includes('walk(document.body,rxs)');
	console.log(`   Client-side script injected: ${hasClientScript ? '✅' : '❌'}`);

	// Quality check: show 3 random original vs cleaned samples
	if (priceMatches.length > 0 && remaining.length === 0) {
		console.log(`\n🔍 Quality check (original → cleaned):`);
		const samples = priceMatches.slice(0, 5);
		for (const p of samples) {
			const orig = p.context;
			let cleaned = orig;
			for (const r of regexes) {
				cleaned = cleaned.replace(r, '');
			}
			cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
			console.log(`  BEFORE: "${orig}"`);
			console.log(`  AFTER:  "${cleaned}"`);
			console.log();
		}
	}

	if (priceMatches.length === 0 && remaining.length === 0) {
		console.log(`\n   ⚠️  NO PRICES IN STATIC HTML — dynamic site (JS loads prices)`);
		return { name: testCase.name, pass: true, note: 'no static prices found', priceCount: result.priceCount };
	} else if (remaining.length === 0) {
		console.log(`\n   ✅ ALL ${priceMatches.length} PRICES REMOVED`);
		return { name: testCase.name, pass: true, priceCount: result.priceCount };
	} else {
		const pct = (((priceMatches.length - remaining.length) / priceMatches.length) * 100).toFixed(1);
		console.log(`\n   ❌ ${remaining.length}/${priceMatches.length} remain (${pct}% removed)`);
		return { name: testCase.name, pass: false, priceCount: result.priceCount, remaining: remaining.length };
	}
}

async function main() {
	console.log('🔧 Price Chopper — Live URL Test Suite\n');

	const TEST_URLS = [
		{
			name: 'Terroni Adelaide (event prices)',
			url: 'https://www.terroni.com/locations/terroni-adelaide',
			currency: 'auto',
		},
		{
			name: 'Gia Restaurant (prefix menu price)',
			url: 'https://giarestaurant.ca/',
			currency: 'auto',
		},
		{
			name: 'IKEA Product Page',
			url: 'https://www.ikea.com/us/en/p/malm-bed-frame-high-white-00401779/',
			currency: 'USD',
		},
		{
			name: 'Walmart Search',
			url: 'https://www.walmart.com/browse/electronics/laptops/3944_3951_1089430',
			currency: 'USD',
		},
		{
			name: 'Uniqlo Product Listing',
			url: 'https://www.uniqlo.com/us/en/men/outerwear',
			currency: 'USD',
		},
		{
			name: 'Gap Product Listing',
			url: 'https://www.gap.com/browse/category.do?cid=1040003',
			currency: 'USD',
		},
	];

	const results = [];
	for (const tc of TEST_URLS) {
		try {
			results.push(await testUrl(tc));
		} catch (err) {
			console.error(`\n❌ Error: ${err.message}`);
			results.push({ name: tc.name, pass: false, error: err.message });
		}
	}

	console.log(`\n${'='.repeat(70)}`);
	console.log(`📊 SUMMARY`);
	console.log(`${'='.repeat(70)}\n`);

	let passed = 0,
		failed = 0,
		noPrices = 0;
	for (const r of results) {
		const icon = r.pass ? '✅' : '❌';
		const detail = r.pass ? r.note || `${r.priceCount} prices removed` : `${r.remaining || 0} remain`;
		console.log(`   ${icon} ${r.name} — ${detail}`);
		r.pass ? passed++ : failed++;
		if (r.note) noPrices++;
	}
	console.log(`\n   ${passed} passed, ${failed} failed (${noPrices} had no static prices)`);
}

main().catch(console.error);
