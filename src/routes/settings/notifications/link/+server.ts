import { error, json } from '@sveltejs/kit';
import { linkDevice } from '#lib/server/push.ts';
import type { RequestHandler } from './$types';

// Push services hand out https URLs; the keys are short base64url strings.
const isEndpoint = (s: unknown): s is string =>
	typeof s === 'string' && s.length <= 2048 && /^https:\/\/[^\s]+$/.test(s);
const isKey = (s: unknown): s is string =>
	typeof s === 'string' && s.length > 0 && s.length <= 256 && /^[A-Za-z0-9_-]+=*$/.test(s);

/**
 * Re-links this browser's notifications to the current sign-in. Sent by the root layout once per
 * app load when the browser has a subscription. Body: `{ endpoint, p256dh, auth }`.
 * Answers `{ status: 'linked' | 'dropped' | 'unknown' }` (see linkDevice in push.ts).
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || !locals.session) error(401, 'Not signed in');
	// JSON only: another site can't send that without the browser asking this one first.
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		error(415, 'Expected JSON');

	const body: unknown = await request.json().catch(() => null);
	const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	if (!isEndpoint(b.endpoint) || !isKey(b.p256dh) || !isKey(b.auth))
		error(400, 'Invalid subscription');

	const status = await linkDevice(locals.user.id, locals.session.id, {
		endpoint: b.endpoint,
		p256dh: b.p256dh,
		auth: b.auth
	});
	return json({ status });
};
