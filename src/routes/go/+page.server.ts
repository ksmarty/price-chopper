import { error } from '@sveltejs/kit';

export function load({ url }) {
	const targetUrl = url.searchParams.get('url');
	const pdfUrl = url.searchParams.get('pdf');
	const pdfDataRaw = url.searchParams.get('pdfData');
	const currency = url.searchParams.get('currency') || 'auto';

	if (!targetUrl && !pdfUrl && !pdfDataRaw) {
		error(400, 'Missing url or pdf parameter');
	}

	let pdfData = null;
	if (pdfDataRaw) {
		try {
			pdfData = JSON.parse(decodeURIComponent(pdfDataRaw));
		} catch {
			// ignore
		}
	}

	return {
		targetUrl,
		pdfUrl,
		pdfData,
		currency,
	};
}
