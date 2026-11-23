// POST /quick-add  { message }  →  { items, title, body, key }
//
// The app's Quick add (signed-in session). Saves a paste to the user's inbox, one item per alert
// or note in it, and reads each (the patterns, then Claude when they can't fill in everything:
// see #lib/server/quick-add/inbox.ts). The Quick add sheet closes as soon as it sends this, and
// the page shows a toast (`title`, `body`) when the answer arrives. Every device with
// notifications on also gets one push for the batch, which the service worker turns into the
// same toast where the app is open (`key` lets the sending page show it only once), so the user
// hears back even if they left. Automations use POST /api/quick-add with a token instead.

import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	announcement,
	batchKey,
	saveToInbox,
	stuckAnnouncement
} from '#lib/server/quick-add/inbox.ts';
import type { RequestHandler } from './$types';

const Body = z.object({
	// Room for several alerts; each one is capped at 2,000 characters when saved.
	message: z.string().trim().min(1).max(10_000)
});

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in first.');
	const body = Body.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, 'Send { "message": "…" } with 1 to 10,000 characters.');

	const saved = await saveToInbox(locals.user, body.data.message);
	if ('error' in saved) error(saved.status, saved.error);
	const items = await saved.read();
	const ids = saved.saved.map((i) => i.id);
	if (!items) return json({ items: [], ...stuckAnnouncement(ids), key: ids.join(',') });
	return json({
		items: items.map((i) => ({ id: i.id, status: i.status })),
		...announcement(items),
		key: batchKey(items)
	});
};
