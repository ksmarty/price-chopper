import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const url = new URL(event.request.url);

	// If this is any request that would 404, check if it came from the proxy iframe
	// (dynamically-loaded scripts from Squarespace etc. resolve to our origin).
	// Try to proxy the request to the target site.
	const referer = event.request.headers.get('referer');
	if (referer && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_app/')) {
		try {
			const refUrl = new URL(referer);
			if (refUrl.pathname.startsWith('/api/proxy') && refUrl.searchParams.has('url')) {
				const targetParam = refUrl.searchParams.get('url');
				if (targetParam) {
					const targetOrigin = new URL(targetParam).origin;
					const assetUrl = targetOrigin + url.pathname + url.search;
					const response = await fetch(assetUrl, {
						headers: {
							'User-Agent':
								'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
						},
					});
					if (response.ok) {
						const headers = new Headers(response.headers);
						headers.set('access-control-allow-origin', '*');
						headers.delete('content-encoding');
						return new Response(response.body, {
							status: response.status,
							headers,
						});
					}
				}
			}
		} catch {
			// fall through to normal 404 handling
		}
	}

	return resolve(event);
};
