import { createHash, timingSafeEqual } from 'node:crypto';
import { json } from '@sveltejs/kit';
import { CRON_SECRET } from '$app/env/private';
import { runTick } from '#lib/server/budget/tick.ts';
import type { RequestHandler } from './$types';

// Called every few minutes by cron-job.org (one job, set up by hand) with
// `Authorization: Bearer ${CRON_SECRET}`. GET and POST both work: some schedulers send a POST
// that looks like a form submission, which SvelteKit's cross-site check would refuse. Creates due recurring charges and sends reminders for
// every user (src/lib/server/budget/tick.ts). Nothing in the request is used except the secret,
// so a caller can only make it check early; running it extra times adds nothing.

/** Constant-time comparison (hashed first so the lengths always match). */
function matches(given: string, expected: string) {
	const a = createHash('sha256').update(given).digest();
	const b = createHash('sha256').update(expected).digest();
	return timingSafeEqual(a, b);
}

const handler: RequestHandler = async ({ request }) => {
	if (!CRON_SECRET) return json({ error: 'CRON_SECRET is not set' }, { status: 503 });
	if (!matches(request.headers.get('authorization') ?? '', `Bearer ${CRON_SECRET}`))
		return json({ error: 'Unauthorized' }, { status: 401 });

	const started = Date.now();
	const result = await runTick();
	return json({ ok: true, ...result, ms: Date.now() - started });
};

export const GET = handler;
export const POST = handler;
