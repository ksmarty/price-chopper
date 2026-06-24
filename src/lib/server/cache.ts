interface CacheEntry {
	data: string;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function getCached(key: string): string | null {
	const entry = cache.get(key);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		cache.delete(key);
		return null;
	}
	return entry.data;
}

export function setCache(key: string, data: string, ttlMs = DEFAULT_TTL_MS): void {
	if (cache.size > 500) {
		const keysToDelete: string[] = [];
		const now = Date.now();
		for (const [k, v] of cache) {
			if (now > v.expiresAt) keysToDelete.push(k);
		}
		for (const k of keysToDelete) cache.delete(k);
	}
	cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function generateCacheKey(url: string, currency: string): string {
	const hash = simpleHash(`${url}|${currency}`);
	return hash;
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return Math.abs(hash).toString(36);
}
