import type { Page } from '$app/state';

/**
 * Returns a query string ("?a=1&b=2", or "" if empty) based on `search`, with keys in
 * `changes` set, or removed when their value is null. Other params are kept.
 */
export function updateQuery(
	search: string,
	changes: Record<string, string | null>
): '' | `?${string}` {
	const params = new URLSearchParams(search);
	for (const [key, value] of Object.entries(changes)) {
		if (value === null) params.delete(key);
		else params.set(key, value);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

/**
 * The URL in the address bar. After a shallow `goto` (the transactions tab and filters), SvelteKit
 * updates only `page.shallow.url`; `page.url` keeps the last full navigation's URL until the next
 * one. Read params and build links from this, or they lag behind (or undo) shallow changes.
 */
export const shownUrl = (page: Pick<Page, 'url' | 'shallow'>) => page.shallow?.url ?? page.url;
