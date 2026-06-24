interface PdfCacheEntry {
	data: Uint8Array;
	fileName: string;
	expiresAt: number;
}

const cache = new Map<string, PdfCacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;

function generateId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < 16; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

export function storePdf(data: Uint8Array, fileName: string): string {
	const id = generateId();
	cache.set(id, { data, fileName, expiresAt: Date.now() + TTL_MS });
	if (cache.size > 100) {
		const now = Date.now();
		for (const [key, entry] of cache) {
			if (now > entry.expiresAt) cache.delete(key);
		}
	}
	return id;
}

export function getPdf(id: string): PdfCacheEntry | null {
	const entry = cache.get(id);
	if (!entry) return null;
	if (Date.now() > entry.expiresAt) {
		cache.delete(id);
		return null;
	}
	return entry;
}
