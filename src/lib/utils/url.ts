export function getParam(name: string): string | null {
	if (typeof window === 'undefined') return null;
	const params = new URLSearchParams(window.location.search);
	return params.get(name);
}

export function setParam(name: string, value: string): string {
	if (typeof window === 'undefined') return '';
	const params = new URLSearchParams(window.location.search);
	params.set(name, value);
	const newSearch = params.toString();
	return newSearch;
}

export function replaceStateParam(name: string, value: string): void {
	if (typeof window === 'undefined') return;
	const params = new URLSearchParams(window.location.search);
	params.set(name, value);
	const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
	window.history.replaceState({}, '', newUrl);
}

export function buildGoUrl(url: string, currency: string): string {
	const params = new URLSearchParams();
	params.set('url', url);
	if (currency && currency !== 'auto') {
		params.set('currency', currency);
	}
	return `/go?${params.toString()}`;
}

export function isValidUrl(str: string): boolean {
	try {
		const url = new URL(str);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
