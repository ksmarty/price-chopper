self.addEventListener('install', function () {
	self.skipWaiting();
});

self.addEventListener('activate', function (event) {
	event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function (event) {
	var url = new URL(event.request.url);
	if (url.pathname.match(/\.(woff2?|ttf|eot|otf)(\?|$)/i)) {
		event.respondWith(
			fetch('/api/font-proxy?url=' + encodeURIComponent(event.request.url)),
		);
	}
});
