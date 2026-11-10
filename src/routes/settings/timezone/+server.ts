import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

/** Saves the browser's IANA time zone so the server knows the user's "today". */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	const body: unknown = await request.json().catch(() => null);
	const timezone =
		body && typeof body === 'object' && 'timezone' in body ? body.timezone : undefined;

	if (typeof timezone !== 'string' || !isValidTimeZone(timezone)) {
		error(400, 'Invalid time zone');
	}

	await db.update(user).set({ timezone }).where(eq(user.id, locals.user.id));
	return json({ timezone });
};

function isValidTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat('en-US', { timeZone });
		return true;
	} catch {
		return false;
	}
}
