import { json } from '@sveltejs/kit';
import { processPdfText } from '$lib/server/pdf-stripper.js';
import { redactPricesFromPdf } from '$lib/server/pdf-redacter.js';
import { storePdf } from '$lib/server/pdf-cache.js';

export async function POST({ request, url }) {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;
	const pdfUrl = formData.get('url') as string | null;
	const currency = (formData.get('currency') as string) || 'auto';

	let pdfBuffer: ArrayBuffer;
	let sourceType: 'upload' | 'url';
	let fileName = 'document.pdf';

	if (file) {
		if (!file.name.endsWith('.pdf') && file.type !== 'application/pdf') {
			return json({ error: 'Only PDF files are supported.' }, { status: 400 });
		}
		if (file.size > 10 * 1024 * 1024) {
			return json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
		}
		pdfBuffer = await file.arrayBuffer();
		fileName = file.name;
		sourceType = 'upload';
	} else if (pdfUrl) {
		try {
			new URL(pdfUrl);
		} catch {
			return json({ error: 'Invalid PDF URL.' }, { status: 400 });
		}

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);
			const response = await fetch(pdfUrl, { signal: controller.signal });
			clearTimeout(timeout);

			if (!response.ok) {
				return json({ error: 'Failed to fetch PDF from URL.' }, { status: 502 });
			}
			pdfBuffer = await response.arrayBuffer();
		} catch {
			return json({ error: 'Failed to fetch PDF. The URL may be inaccessible.' }, { status: 502 });
		}

		sourceType = 'url';
	} else {
		return json({ error: 'No file or URL provided.' }, { status: 400 });
	}

	try {
		const pdfParse = (await import('pdf-parse')).default;
		const data = await pdfParse(Buffer.from(pdfBuffer));

		const result = await processPdfText(data.text, currency);

		const modifiedPdf = await redactPricesFromPdf(pdfBuffer, currency);
		const previewToken = storePdf(modifiedPdf, fileName);

		return json({
			success: true,
			sourceType,
			fileName,
			pageCount: data.numpages,
			totalPriceCount: result.totalPriceCount,
			previewToken,
			pages: result.pages.map((p) => ({
				pageNumber: p.pageNumber,
				text: p.cleanedText,
			})),
			metadata: {
				title: data.info?.Title || fileName,
				author: data.info?.Author || null,
			},
		});
	} catch (err) {
		return json(
			{
				error: 'Failed to process PDF. The file may be corrupted or password-protected.',
				detail: err instanceof Error ? err.message : String(err),
			},
			{ status: 500 },
		);
	}
}

export async function GET({ url }) {
	const pdfUrl = url.searchParams.get('url');
	const currency = url.searchParams.get('currency') || 'auto';

	if (!pdfUrl) {
		return json({ error: 'Missing url parameter' }, { status: 400 });
	}

	try {
		new URL(pdfUrl);
	} catch {
		return json({ error: 'Invalid PDF URL' }, { status: 400 });
	}

	let response: Response;
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		response = await fetch(pdfUrl, { signal: controller.signal });
		clearTimeout(timeout);
	} catch {
		return json({ error: 'Failed to fetch the PDF URL.' }, { status: 502 });
	}

	if (!response.ok) {
		return json({ error: 'Failed to fetch PDF.' }, { status: 502 });
	}

	const pdfBuffer = await response.arrayBuffer();

	try {
		const pdfParse = (await import('pdf-parse')).default;
		const data = await pdfParse(Buffer.from(pdfBuffer));

		const result = await processPdfText(data.text, currency);

		const modifiedPdf = await redactPricesFromPdf(pdfBuffer, currency);
		const previewToken = storePdf(modifiedPdf, pdfUrl.split('/').pop() || 'document.pdf');

		return json({
			success: true,
			sourceType: 'url',
			fileName: pdfUrl.split('/').pop() || 'document.pdf',
			pageCount: data.numpages,
			totalPriceCount: result.totalPriceCount,
			previewToken,
			pages: result.pages.map((p) => ({
				pageNumber: p.pageNumber,
				text: p.cleanedText,
			})),
			metadata: {
				title: data.info?.Title || pdfUrl.split('/').pop() || 'document.pdf',
				author: data.info?.Author || null,
			},
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return json(
			{
				error: 'Failed to process PDF. The file may be corrupted or password-protected.',
				detail: msg,
			},
			{ status: 500 },
		);
	}
}
