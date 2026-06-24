export async function GET({ url, fetch }) {
	const targetUrl = url.searchParams.get('url');
	if (!targetUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	try {
		const resp = await fetch(targetUrl);
		const headers = new Headers(resp.headers);
		headers.set('Access-Control-Allow-Origin', '*');
		return new Response(resp.body, { status: resp.status, headers });
	} catch {
		return new Response('Failed to fetch asset', { status: 502 });
	}
}
