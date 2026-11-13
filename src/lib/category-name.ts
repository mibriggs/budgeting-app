// Category name rules, shared by the Categories page and the server.
//
// - What's stored: trimmed, with runs of spaces collapsed ("  Eating   out " → "Eating out").
//   Punctuation is kept, since names like "Personal & Misc." use it.
// - What counts as the same name: letters and digits only, ignoring case, accents, spaces and
//   punctuation. So "Laundry.", "laundry" and "LAUNDRY!" all clash with "Laundry", and curly vs
//   straight quotes don't make a new name. (The database's unique index only ignores case; this
//   is the stricter check the app applies before saving.)

/** The name as it will be stored. */
export function tidyCategoryName(name: string): string {
	return name.trim().replace(/\s+/g, ' ');
}

/** A key for comparing names; two names clash when their keys are equal. Empty means no letters or digits. */
export function categoryNameKey(name: string): string {
	return name
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');
}
