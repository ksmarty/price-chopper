export interface Currency {
	code: string;
	symbol: string;
	name: string;
	prefix: boolean;
	decimals: number;
}

export const currencies: Record<string, Currency> = {
	auto: { code: 'auto', symbol: '', name: 'Auto-detect', prefix: true, decimals: 2 },
	USD: { code: 'USD', symbol: '$', name: 'US Dollar', prefix: true, decimals: 2 },
	EUR: { code: 'EUR', symbol: '€', name: 'Euro', prefix: true, decimals: 2 },
	GBP: { code: 'GBP', symbol: '£', name: 'British Pound', prefix: true, decimals: 2 },
	JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', prefix: true, decimals: 0 },
	CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', prefix: true, decimals: 2 },
	AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', prefix: true, decimals: 2 },
	CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', prefix: true, decimals: 2 },
	INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', prefix: true, decimals: 2 },
	BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', prefix: true, decimals: 2 },
	CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', prefix: true, decimals: 2 },
	KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', prefix: true, decimals: 0 },
	SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', prefix: false, decimals: 2 },
	NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', prefix: false, decimals: 2 },
	DKK: { code: 'DKK', symbol: 'kr', name: 'Danish Krone', prefix: false, decimals: 2 },
	NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', prefix: true, decimals: 2 },
	MXN: { code: 'MXN', symbol: 'Mex$', name: 'Mexican Peso', prefix: true, decimals: 2 },
	SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', prefix: true, decimals: 2 },
	HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', prefix: true, decimals: 2 },
	TRY: { code: 'TRY', symbol: '₺', name: 'Turkish Lira', prefix: true, decimals: 2 },
	PLN: { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', prefix: false, decimals: 2 },
};

export function getCurrency(code: string): Currency {
	return currencies[code] ?? currencies.auto;
}

export function getSymbolPattern(currency: Currency): string {
	if (currency.code === 'auto') {
		const symbols = Object.values(currencies)
			.filter((c) => c.code !== 'auto')
			.map((c) => {
				const s = c.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				return c.prefix ? s : s;
			})
			.join('|');
		return symbols;
	}
	return currency.symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
