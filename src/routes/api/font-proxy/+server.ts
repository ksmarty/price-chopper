const STRIP_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding'];

export async function GET({ url, fetch }) {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 20000);
		const resp = await fetch(targetUrl, { signal: controller.signal });
		clearTimeout(timeout);
		const headers = new Headers(resp.headers);
		for (const h of STRIP_HEADERS) headers.delete(h);
		headers.set('Access-Control-Allow-Origin', '*');
		headers.set('Content-Type', resp.headers.get('content-type') || 'application/octet-stream');
		const buf = await resp.arrayBuffer();
		return new Response(buf, { status: resp.status, headers });
	} catch (e) {
		return new Response('Failed to fetch asset: ' + (e as Error)?.message, { status: 502 });
	}
}
