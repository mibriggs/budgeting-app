// Initials for the user menu, from the name Google or GitHub gives us (see displayName in
// src/lib/server/user.ts): "Owen Briggs" → "OB", "Ada" → "A", "mibriggs" (a GitHub username
// with no display name) → "M". Empty for the "Account" fallback, so the generic icon shows.

export function initials(name: string): string {
	const words = name
		.trim()
		.split(/\s+/)
		.filter((w) => /\p{L}|\p{N}/u.test(w));
	if (words.length === 0 || name === 'Account') return '';
	const first = (w: string) => [...w.replace(/^[^\p{L}\p{N}]+/u, '')][0]?.toUpperCase() ?? '';
	return words.length === 1 ? first(words[0]) : first(words[0]) + first(words.at(-1)!);
}
