import { getCached, setCache, generateCacheKey } from '$lib/server/cache.js';
import CLIENT_SCRIPT from '$lib/client/price-remover.js?raw';

const CSS_LINK_RE = /<link[^>]*?\brel=["']stylesheet["'][^>]*?\bhref=["']([^"']+)["'][^>]*\/?>/gi;
const CSS_URL_RE = /\burl\(\s*(['"]?)((?!data:)[^'")]+)\1\s*\)/g;

function resolveUrl(ref: string, base: string): string {
	try {
		return new URL(ref.trim(), base).href;
	} catch {
		return ref.trim();
	}
}

async function inlineCss(html: string, pageUrl: string, fetchFn: typeof fetch, proxyOrigin: string): Promise<string> {
	const matches: Array<{ full: string; href: string }> = [];
	let m: RegExpExecArray | null;
	while ((m = CSS_LINK_RE.exec(html)) !== null) {
		matches.push({ full: m[0], href: m[1] });
	}
	if (matches.length === 0) return html;

	const pageBase = pageUrl.replace(/\/[^/]*$/, '/');
	let result = html;

	for (const { full, href } of matches) {
		const cssUrl = resolveUrl(href, pageBase);
		if (!cssUrl) continue;

		try {
			const resp = await fetchFn(cssUrl);
			if (!resp.ok) continue;
			let css = await resp.text();

			css = css.replace(CSS_URL_RE, (_m: string, q: string, ref: string) => {
				const absolute = resolveUrl(ref, cssUrl);
				if (!absolute) return _m;
				return `url(${q}${proxyOrigin}/api/font-proxy?url=${encodeURIComponent(absolute)}${q})`;
			});

			result = result.replace(full, `<style>${css}</style>`);
		} catch {
			continue;
		}
	}
	return result;
}

function rewriteInlineStyles(html: string, pageUrl: string, proxyOrigin: string): string {
	const STYLE_TAG_RE = /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi;
	return html.replace(STYLE_TAG_RE, (_all, openTag, cssContent, closeTag) => {
		const updatedCss = cssContent.replace(CSS_URL_RE, (_m: string, q: string, ref: string) => {
			const absolute = resolveUrl(ref, pageUrl);
			if (!absolute) return _m;
			return `url(${q}${proxyOrigin}/api/font-proxy?url=${encodeURIComponent(absolute)}${q})`;
		});
		return `${openTag}${updatedCss}${closeTag}`;
	});
}

export async function GET({ url, fetch }) {
	const targetUrl = url.searchParams.get('url');
	const currency = url.searchParams.get('currency') || 'auto';

	if (!targetUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	try {
		new URL(targetUrl);
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	const cacheKey = generateCacheKey(targetUrl, currency);
	const cached = getCached(cacheKey);
	if (cached) {
		return new Response(cached, {
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'x-cache': 'HIT',
			},
		});
	}

	let response;
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);

		response = await fetch(targetUrl, {
			signal: controller.signal,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			},
			redirect: 'follow',
		});
		clearTimeout(timeout);
	} catch {
		return new Response('Failed to fetch the URL. The site may be inaccessible or blocking requests.', {
			status: 502,
		});
	}

	let html = await response.text();

	html = await inlineCss(html, targetUrl, fetch, url.origin);
	html = rewriteInlineStyles(html, targetUrl, url.origin);

	const baseTag = `<base href="${targetUrl.replace(/\/[^/]*$/, '/')}">`;
	const withBase = html.replace('<head>', `<head>${baseTag}`);

	const withScript = withBase.replace(
		'</body>',
		(match) => `<script>${CLIENT_SCRIPT}</script>${match}`,
	);
	const result = withScript === withBase ? withBase + `<script>${CLIENT_SCRIPT}</script>` : withScript;

	setCache(cacheKey, result);

	return new Response(result, {
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'x-cache': 'MISS',
		},
	});
}
