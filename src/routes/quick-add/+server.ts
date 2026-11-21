// POST /quick-add  { message, pushEndpoint? }  →  { item }
//
// Saves a pasted alert or typed note to the user's inbox and reads it (the patterns, then Claude
// when they can't fill in everything: see #lib/server/quick-add/inbox.ts), then returns the item.
// The Quick add sheet closes as soon as it sends this, and the page shows a toast when the answer
// arrives. `pushEndpoint` is the sending device's push address: it also gets a push, which the
// service worker turns into a toast if the app is open, so the user hears back even if they left.

import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { addToInbox, summary } from '#lib/server/quick-add/inbox.ts';
import type { RequestHandler } from './$types';

const Body = z.object({
	message: z.string().trim().min(1).max(2000),
	pushEndpoint: z.url().startsWith('https://').max(1000).optional()
});

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Sign in first.');
	const body = Body.safeParse(await request.json().catch(() => null));
	if (!body.success) error(400, 'Send { "message": "…" } with 1 to 2,000 characters.');

	const result = await addToInbox(locals.user, body.data.message, body.data.pushEndpoint);
	if ('error' in result) error(400, result.error);
	return json({
		item: result.item && { ...result.item, summary: summary(result.item) }
	});
};
