// POST /quick-add  { message, pushEndpoint? }  →  { items, title, body, key }
//
// Saves a paste to the user's inbox, one item per alert or note in it, and reads each (the
// patterns, then Claude when they can't fill in everything: see #lib/server/quick-add/inbox.ts).
// The Quick add sheet closes as soon as it sends this, and the page shows a toast (`title`,
// `body`) when the answer arrives. `pushEndpoint` is the sending device's push address: it also
// gets one push for the batch, which the service worker turns into the same toast if the app is
// open (`key` lets the page show it only once), so the user hears back even if they left.

import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { addToInbox, announcement, batchKey } from '#lib/server/quick-add/inbox.ts';
import type { RequestHandler } from './$types';

const Body = z.object({
	// Room for several alerts; each one is capped at 2,000 characters when saved.
	message: z.string().trim().min(1).max(10_000),
	pushEndpoint: z.url().startsWith('https://').max(1000).optional()
});

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in first.');
	const body = Body.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, 'Send { "message": "…" } with 1 to 10,000 characters.');

	const result = await addToInbox(locals.user, body.data.message, body.data.pushEndpoint);
	if ('error' in result) error(400, result.error);
	return json({
		items: result.items.map((i) => ({ id: i.id, status: i.status })),
		...announcement(result.items),
		key: batchKey(result.items)
	});
};
