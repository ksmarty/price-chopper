import { PDFDocument, rgb } from 'pdf-lib';

interface TextItem {
	str: string;
	width: number;
	height: number;
	transform: number[];
}

interface PriceRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

function getTextItems(pdfData: Uint8Array): Promise<TextItem[][]> {
	return new Promise((resolve, reject) => {
		import('pdfjs-dist/build/pdf.js').then((mod) => {
			const pdfjsLib = (mod as any).default || mod;
			pdfjsLib.disableWorker = true;
			const loadingTask = pdfjsLib.getDocument({ data: pdfData });
			loadingTask.promise.then(async (doc: any) => {
				const pageItems: TextItem[][] = [];
				for (let i = 1; i <= doc.numPages; i++) {
					const page = await doc.getPage(i);
					const content = await page.getTextContent();
					const items: TextItem[] = content.items.map((item: any) => ({
						str: item.str,
						width: item.width || 0,
						height: item.height || 0,
						transform: item.transform || [1, 0, 0, 1, 0, 0],
					}));
					pageItems.push(items);
					page.cleanup();
				}
				doc.destroy();
				resolve(pageItems);
			}).catch(reject);
		}).catch(reject);
	});
}

const H_GAP = 20;
const Y_TOLERANCE = 6;

function isDigitLike(s: string): boolean {
	return /^\d+\.?\d*$/.test(s);
}

function isDot(s: string): boolean {
	return s === '.';
}

function findPriceRects(items: TextItem[][], _currency: string): PriceRect[][] {
	const pageRects: PriceRect[][] = [];
	const used = new Set<TextItem>();

	for (const page of items) {
		const rects: PriceRect[] = [];
		used.clear();

		for (const start of page) {
			if (used.has(start)) continue;
			const s = start.str.trim();
			if (!s) continue;
			if (!isDigitLike(s) && !isDot(s)) continue;

			const chain: TextItem[] = [start];
			used.add(start);
			let cursorX = start.transform[4] + start.width;

			for (const next of page) {
				if (used.has(next)) continue;
				if (Math.abs(next.transform[5] - start.transform[5]) > Y_TOLERANCE) continue;
				const nx = next.transform[4];
				if (nx > cursorX - 3 && nx < cursorX + H_GAP) {
					const ns = next.str.trim();
					if (isDigitLike(ns) || isDot(ns)) {
						chain.push(next);
						used.add(next);
						cursorX = nx + next.width;
					}
				}
			}

			const text = chain.map((t) => t.str).join('');
			if (!text || text === '.') continue;

			const isPrice =
				/^\d{1,3}\.\d{1,2}$/.test(text) ||
				/^\d{1,3}$/.test(text);

			if (!isPrice) continue;

			const first = chain[0];
			const last = chain[chain.length - 1];
			const x = first.transform[4];
			const yBaseline = Math.min(...chain.map((t) => t.transform[5]));
			const heights = chain.map((t) => t.height).filter((h) => h > 0);
			const h = heights.length > 0 ? Math.max(...heights) : 11;
			const w = last.transform[4] + last.width - first.transform[4];

			const pad = 3;
			rects.push({
				x: x - pad,
				y: yBaseline - pad,
				width: w + pad * 2,
				height: h + pad * 3,
			});
		}

		pageRects.push(rects);
	}

	return pageRects;
}

export async function redactPricesFromPdf(
	pdfBuffer: ArrayBuffer,
	currency: string,
): Promise<Uint8Array> {
	const pdfBytes = new Uint8Array(pdfBuffer);

	const textItems = await getTextItems(pdfBytes);
	const pageRects = findPriceRects(textItems, currency);

	const pdfDoc = await PDFDocument.load(pdfBuffer);
	const pages = pdfDoc.getPages();

	const seen = new Set<string>();

	for (let i = 0; i < pages.length; i++) {
		const page = pages[i];
		const rects = pageRects[i] || [];

		for (const rect of rects) {
			const key = `${rect.x.toFixed(1)}_${rect.y.toFixed(1)}_${rect.width.toFixed(1)}_${rect.height.toFixed(1)}`;
			if (seen.has(key)) continue;
			seen.add(key);

			page.drawRectangle({
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				color: rgb(1, 1, 1),
				borderColor: undefined,
				borderWidth: 0,
				opacity: 1,
			});
		}
	}

	return pdfDoc.save();
}
