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
