const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdWhole = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	maximumFractionDigits: 0
});
const usdCompact = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	notation: 'compact',
	maximumFractionDigits: 1
});

/** 1234 → "$12.34" */
export function formatCents(cents: number): string {
	return usd.format(cents / 100);
}

/** 123456 → "$1,235" (no cents), for headline figures. */
export function formatCentsWhole(cents: number): string {
	return usdWhole.format(Math.round(cents / 100));
}

/** Dollars for chart axes: under $10,000 in full ("$2,000"), above that compact ("$12K"). */
export function formatAxisDollars(dollars: number): string {
	return Math.abs(dollars) < 10_000 ? usdWhole.format(dollars) : usdCompact.format(dollars);
}

/** Dollars (as charts use) → "$12.34" */
export function formatDollars(dollars: number): string {
	return usd.format(dollars);
}
