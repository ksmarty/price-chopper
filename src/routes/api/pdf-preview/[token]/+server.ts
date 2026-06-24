import { getPdf } from '$lib/server/pdf-cache.js';

export function GET({ params, url }) {
	const entry = getPdf(params.token);
	if (!entry) {
		return new Response('PDF not found or expired', { status: 404 });
	}

	const isDownload = url.searchParams.get('download') === 'true';

	return new Response(Buffer.from(entry.data), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': isDownload
				? `attachment; filename="${entry.fileName.replace(/\.pdf$/i, '')}-chopped.pdf"`
				: `inline; filename="${entry.fileName.replace(/\.pdf$/i, '')}-chopped.pdf"`,
			'cache-control': 'no-cache',
		},
	});
}
