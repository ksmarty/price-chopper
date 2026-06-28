import { load } from 'cheerio';
import type { Text, Element, AnyNode } from 'domhandler';
import { currencies } from '$lib/utils/currencies';

export function buildPriceRegexes(currencyCode: string): RegExp[] {
	const patterns: RegExp[] = [];

	if (currencyCode === 'auto') {
		const entries = Object.entries(currencies).filter(([code]) => code !== 'auto');
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
		patterns.push(/\b\d{1,3}(?:\.\d{2})\b/g);
	} else {
		const curr = currencies[currencyCode];
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

export function removePriceFromText(text: string, regexes: RegExp[]): string {
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
		.replace(/^\)\s*/g, '')
		.replace(/^\(\s*/g, '')
		.replace(/\b(?:was|now|only|from|starting at)\s*,?\s*$/gi, '')
		.replace(/[,;:]+\s*$/g, '')
		.replace(/\s+$/g, '')
		.replace(/^\s+/g, '');
	if (result.length === 1 && /[,.!?;:)('"+\-]/.test(result)) {
		result = '';
	}
	return result;
}

const PRICE_ATTRIBUTES = new Set([
	'data-price',
	'data-amount',
	'data-product-price',
	'data-product-price-amount',
	'data-price-type',
	'data-price-currency',
	'data-sale-price',
	'data-original-price',
	'data-regular-price',
	'data-current-price',
]);

const META_PRICE_PROPERTIES = [
	'product:price:amount',
	'product:price:currency',
	'product:sale_price:amount',
	'product:original_price',
	'price',
	'price:amount',
	'price:currency',
	'sale_price',
	'original_price',
	'product:retailer_item_id',
];

const ITEMPROP_PRICE_NAMES = ['price', 'priceCurrency', 'lowPrice', 'highPrice', 'priceRange', 'offers'];

// Containers whose entire contents are a price. These are blanked wholesale because
// the amount and currency symbol are often split across separate child elements
// (e.g. Squarespace menu blocks: <span class="currency-sign">$</span>86), which means
// the per-text-node regexes never see a full "$86" to match.
const PRICE_CONTAINER_SELECTORS = [
	'.menu-item-price-top',
	'.menu-item-price-bottom',
	'.menu-item-price',
	'.currency-sign',
	'.sqs-money-native',
	'.product-price',
	'.product-mark-price',
	'.sqs-product-price',
];

export interface StripOptions {
	currency: string;
}

export interface StripResult {
	cleaned: string;
	title: string;
	priceCount: number;
}

export function stripPrices(html: string, options: StripOptions): StripResult {
	const $ = load(html, { xmlMode: false });
	const regexes = buildPriceRegexes(options.currency);
	let priceCount = 0;

	const textNodes: Array<{ node: Text; newText: string }> = [];

	const walkTextNodes = (element: AnyNode) => {
		if (element.type === 'text') {
			const textNode = element as Text;
			const original = textNode.data || '';
			if (!original.trim()) return;

			const cleaned = removePriceFromText(original, regexes);
			if (cleaned !== original) {
				const matchCount = regexes.reduce((sum, r) => {
					const matches = original.match(r);
					return sum + (matches ? matches.length : 0);
				}, 0);
				priceCount += matchCount;
				textNodes.push({ node: textNode, newText: cleaned });
			}
			return;
		}

		if (element.type === 'tag') {
			const tag = element as Element;
			const skipTags = new Set(['script', 'style', 'noscript', 'svg', 'math']);
			if (skipTags.has(tag.tagName)) return;

			if (tag.children) {
				for (const child of tag.children) {
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

	// Blank known price-container elements wholesale (handles split currency/amount markup).
	for (const selector of PRICE_CONTAINER_SELECTORS) {
		$(selector).each((_, el) => {
			let had = false;
			$(el)
				.find('*')
				.addBack()
				.contents()
				.each((_, child) => {
					if (child.type === 'text' && (child as Text).data?.trim()) {
						(child as Text).data = '';
						had = true;
					}
				});
			if (had) priceCount++;
		});
	}

	PRICE_ATTRIBUTES.forEach((key) => {
		$(`[${key}]`).each((_, el) => {
			const attrValue = $(el).attr(key);
			if (attrValue) {
				const cleaned = attrValue.replace(/[\d.,]+/g, '');
				$(el).attr(key, cleaned.trim() || '');
				if (cleaned !== attrValue) priceCount++;
			}
		});
	});

	for (const prop of META_PRICE_PROPERTIES) {
		$(`meta[property="${prop}"], meta[name="${prop}"]`).each((_, el) => {
			$(el).attr('content', '');
			priceCount++;
		});
	}

	for (const name of ITEMPROP_PRICE_NAMES) {
		$(`[itemprop="${name}"]`).each((_, el) => {
			const tag = el as Element;
			if (tag.tagName === 'meta') {
				$(el).attr('content', '');
			} else {
				$(el)
					.contents()
					.each((_, child) => {
						if (child.type === 'text') {
							child.data = '';
						}
					});
			}
			priceCount++;
		});
	}

	const title = $('title').text() || 'Untitled';

	let cleaned = $.html();
	cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

	return { cleaned, title, priceCount };
}
