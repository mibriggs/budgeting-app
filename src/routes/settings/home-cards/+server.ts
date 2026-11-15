import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

/**
 * Shows or hides the home page "Credit cards" card for this account (all devices).
 * Body: `{ "creditCards": true | false }`. Called by the × on the card, its Undo, and the switch
 * in Settings → Payment methods.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');
	// JSON only: another site can't send that without the browser asking this one first, so a
	// cross-site form can't flip the setting (on top of the SameSite=Lax session cookie).
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		error(415, 'Expected JSON');

	const body: unknown = await request.json().catch(() => null);
	const creditCards =
		body && typeof body === 'object' && 'creditCards' in body ? body.creditCards : undefined;
	if (typeof creditCards !== 'boolean') error(400, 'Expected { creditCards: boolean }');

	await db.update(user).set({ showCreditCards: creditCards }).where(eq(user.id, locals.user.id));
	return json({ creditCards });
};
