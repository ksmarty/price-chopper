// @ts-nocheck
var CURRENCIES = {
	USD: { s: '$', p: true, d: 2 },
	EUR: { s: '\u20ac', p: true, d: 2 },
	GBP: { s: '\u00a3', p: true, d: 2 },
	JPY: { s: '\u00a5', p: true, d: 0 },
	CAD: { s: 'CA$', p: true, d: 2 },
	AUD: { s: 'A$', p: true, d: 2 },
	CNY: { s: '\u00a5', p: true, d: 2 },
	INR: { s: '\u20b9', p: true, d: 2 },
	BRL: { s: 'R$', p: true, d: 2 },
	CHF: { s: 'CHF', p: true, d: 2 },
	KRW: { s: '\u20a9', p: true, d: 0 },
	SEK: { s: 'kr', p: false, d: 2 },
	NOK: { s: 'kr', p: false, d: 2 },
	DKK: { s: 'kr', p: false, d: 2 },
};

function esc(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function build(code) {
	var r = [];
	if (code === 'auto' || !code) {
		var e = Object.entries(CURRENCIES);
		for (var i = 0; i < e.length; i++) {
			var x = e[i][1],
				sym = esc(x.s);
			if (!sym) continue;
			if (x.p) {
				r.push(new RegExp('(?:,?\\s*)' + sym + '\\s*\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?', 'gi'));
			} else {
				r.push(new RegExp('\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,' + x.d + '})?\\s*' + sym, 'gi'));
			}
		}
		r.push(/\b(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|BRL|KRW|SEK|NOK|DKK)\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/gi);
		r.push(/\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|BRL|KRW|SEK|NOK|DKK)\b/gi);
		r.push(/\b\d{1,3}(?:\.\d{2})\b/g);
		r.push(/(?<![.\d-])\+\d{1,3}\b(?=\s*(?:\/|$))/g);
		r.push(/(?<![.\d-+])\b\d{2,3}\b(?=\s*(?:\/|$))/g);
	} else {
		var x = CURRENCIES[code];
		if (x && x.s) {
			var sym = esc(x.s);
			if (x.p) {
				r.push(new RegExp('(?:,?\\s*)' + sym + '\\s*\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,' + x.d + '})?', 'g'));
			} else {
				r.push(new RegExp('\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,' + x.d + '})?\\s*' + sym, 'g'));
			}
		}
	}
	return r;
}

function strip(text, rxs) {
	var res = text;
	for (var i = 0; i < rxs.length; i++) {
		res = res.replace(rxs[i], function (m) {
			return m.replace(/./g, ' ');
		});
	}
	return res;
}

function walk(root, rxs) {
	var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
	var nodes = [],
		node;
	while ((node = tw.nextNode())) {
		var skip = { script: true, style: true, noscript: true, svg: true, math: true },
			p = node.parentNode;
		if (p && skip[p.tagName ? p.tagName.toLowerCase() : '']) continue;
		var orig = node.nodeValue || '';
		if (!orig.trim()) continue;
		var cleaned = strip(orig, rxs);
		if (cleaned !== orig) nodes.push({ n: node, t: cleaned });
	}
	for (var j = 0; j < nodes.length; j++) nodes[j].n.nodeValue = nodes[j].t;
	return nodes.length;
}

var FONT_URL_RE = /\burl\(\s*(['"]?)((?!data:)[^'")]+)\1\s*\)/g;

function proxyUrl(ref, base) {
	var abs;
	try { abs = new URL(ref, base).href; } catch (e) { return null; }
	return window.location.origin + '/api/font-proxy?url=' + encodeURIComponent(abs);
}

function rewriteFontUrls(root) {
	var baseHref = (document.querySelector('base') || {}).href || window.location.href;

	// Inline <style> elements
	var styles = root.querySelectorAll('style:not([data-fp-processed])');
	for (var i = 0; i < styles.length; i++) {
		var css = styles[i].textContent || '';
		if (css.indexOf('font-proxy') !== -1) { styles[i].setAttribute('data-fp-processed', ''); continue; }
		var rewritten = css.replace(FONT_URL_RE, function(m, q, ref) {
			var proxied = proxyUrl(ref, baseHref);
			return proxied ? 'url(' + q + proxied + q + ')' : m;
		});
		if (rewritten !== css) styles[i].textContent = rewritten;
		styles[i].setAttribute('data-fp-processed', '');
	}

	// <link rel="stylesheet"> — fetch through proxy, inline, rewrite
	var links = root.querySelectorAll('link[rel="stylesheet"]:not([data-fp-processed])');
	for (var i = 0; i < links.length; i++) {
		var link = links[i];
		link.setAttribute('data-fp-processed', '');
		var href = link.getAttribute('href');
		if (!href) continue;
		(function (lk, origHref) {
			fetch(window.location.origin + '/api/font-proxy?url=' + encodeURIComponent(origHref))
				.then(function (r) { return r.ok ? r.text() : null; })
				.then(function (css) {
					if (!css) return;
					var baseUrl = (function () {
						try { return new URL(origHref, baseHref).href; } catch (e) { return baseHref; }
					})();
					var rewritten = css.replace(FONT_URL_RE, function (m, q, ref) {
						var proxied = proxyUrl(ref, baseUrl);
						return proxied ? 'url(' + q + proxied + q + ')' : m;
					});
					var style = document.createElement('style');
					style.setAttribute('data-fp-processed', '');
					style.textContent = rewritten;
					if (lk.parentNode) lk.parentNode.replaceChild(style, lk);
				})
				.catch(function () {});
		})(link, href);
	}
}

// Containers whose entire contents are a price. Blanked wholesale because the amount
// and currency symbol are often split across separate child elements (e.g. Squarespace
// menu blocks: <span class="currency-sign">$</span>86), so the per-text-node regexes
// never see a full "$86" to match.
var PRICE_CONTAINER_SELECTORS = [
	'.menu-item-price-top',
	'.menu-item-price-bottom',
	'.menu-item-price',
	'.currency-sign',
	'.sqs-money-native',
	'.product-price',
	'.product-mark-price',
	'.sqs-product-price',
];

function blankPriceContainers(root) {
	for (var s = 0; s < PRICE_CONTAINER_SELECTORS.length; s++) {
		var els = root.querySelectorAll(PRICE_CONTAINER_SELECTORS[s]);
		for (var e = 0; e < els.length; e++) {
			var tw = document.createTreeWalker(els[e], NodeFilter.SHOW_TEXT, null);
			var n;
			while ((n = tw.nextNode())) {
				if (n.nodeValue && n.nodeValue.trim()) n.nodeValue = '';
			}
		}
	}
}

function clean(root, rxs) {
	rewriteFontUrls(root);
	walk(root, rxs);
	blankPriceContainers(root);
	var overlays = root.querySelectorAll(
		'.location-blackout, .blackout, .page-overlay, .loading-overlay, .site-overlay, .splash-screen, .w-condition-invisible',
	);
	for (var i = 0; i < overlays.length; i++) {
		var el = overlays[i];
		el.style.setProperty('display', 'none', 'important');
		if (el.parentNode) el.parentNode.removeChild(el);
	}
	var priceAttrs = [
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
	];
	for (var a = 0; a < priceAttrs.length; a++) {
		var els = root.querySelectorAll('[' + priceAttrs[a] + ']');
		for (var e = 0; e < els.length; e++) {
			els[e].removeAttribute(priceAttrs[a]);
		}
	}
	var itemprops = ['price', 'priceCurrency', 'lowPrice', 'highPrice', 'priceRange', 'offers'];
	for (var ip = 0; ip < itemprops.length; ip++) {
		var ies = root.querySelectorAll('[itemprop="' + itemprops[ip] + '"]');
		for (var ie = 0; ie < ies.length; ie++) {
			var el = ies[ie];
			if (el.tagName === 'META') {
				el.setAttribute('content', '');
			} else {
				var tw2 = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
				var n2;
				while ((n2 = tw2.nextNode())) {
					n2.nodeValue = '';
				}
			}
		}
	}
}

function getParam(name) {
	return (window.location.href.match(new RegExp('[?&]' + name + '=([^&]+)')) || [])[1] || null;
}

function run() {
	clean(document.body, rxs);
}

var cur = getParam('currency') || 'auto';
var rxs = build(cur);

run();

setTimeout(run, 3000);
setTimeout(run, 10000);
setTimeout(run, 30000);

var cleaning = false;
var obs = new MutationObserver(function () {
	if (cleaning) return;
	cleaning = true;
	clean(document.body, rxs);
	cleaning = false;
});
obs.observe(document.body, { childList: true, subtree: true, characterData: true });

if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
	navigator.serviceWorker.register('/sw.js').catch(function () {});
}
