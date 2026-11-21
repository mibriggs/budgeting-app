import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import { user } from '#lib/server/db/schema.ts';
import type { RequestHandler } from './$types';

/**
 * Turns Claude in Quick add on or off for this account (all devices). Body: `{ "enabled": bool }`.
 * Called by the switch in Settings → AI. Quick add checks the saved value on every reading
 * (see loadContext in #lib/server/quick-add/inbox.ts).
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');
	// JSON only: another site can't send that without the browser asking this one first, so a
	// cross-site form can't flip the setting (on top of the SameSite=Lax session cookie).
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		error(415, 'Expected JSON');

	const body: unknown = await request.json().catch(() => null);
	const enabled = body && typeof body === 'object' && 'enabled' in body ? body.enabled : undefined;
	if (typeof enabled !== 'boolean') error(400, 'Expected { enabled: boolean }');

	await db.update(user).set({ aiEnabled: enabled }).where(eq(user.id, locals.user.id));
	return json({ enabled });
};
