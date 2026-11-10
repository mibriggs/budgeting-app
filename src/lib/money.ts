const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1234 → "$12.34" */
export function formatCents(cents: number): string {
	return usd.format(cents / 100);
}
