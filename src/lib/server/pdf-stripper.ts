import { buildPriceRegexes, removePriceFromText } from './price-stripper';

export interface PdfPage {
	pageNumber: number;
	originalText: string;
	cleanedText: string;
}

export interface PdfResult {
	pages: PdfPage[];
	totalPriceCount: number;
}

export async function processPdfText(text: string, currency: string): Promise<PdfResult> {
	const pageSeparator = '\f';
	const rawPages = text.split(pageSeparator).filter((p) => p.trim());

	const regexes = buildPriceRegexes(currency);

	const pages: PdfPage[] = [];
	let totalPriceCount = 0;

	for (let i = 0; i < rawPages.length; i++) {
		const pageText = rawPages[i].trim();
		if (!pageText) continue;

		const countMatches = () => {
			let c = 0;
			for (const r of regexes) {
				const m = pageText.match(r);
				if (m) c += m.length;
			}
			return c;
		};

		const priceCount = countMatches();
		const cleanedText = removePriceFromText(pageText, regexes).replace(/\s+/g, ' ').trim();

		pages.push({
			pageNumber: i + 1,
			originalText: pageText,
			cleanedText,
		});

		totalPriceCount += priceCount;
	}

	return { pages, totalPriceCount };
}
