// Web Push: saving the devices that turned notifications on, and sending to them.
//
// Each device's browser gives us a subscription (a unique endpoint URL at Apple's, Google's or
// Mozilla's push service, plus keys to encrypt to it). notify() signs each message with our
// VAPID keys and sends it there; the push service delivers it even when the app is closed, and
// the service worker (src/service-worker/index.ts) shows it. No third-party account involved.
//
// Each device belongs to the sign-in (session) that turned it on. Nothing is sent to a device
// whose session has ended (signed out elsewhere, or expired), so a phone you're logged out of
// stops showing your amounts. Signing back in on it links it to the new session again.

import { and, eq, gt, inArray } from 'drizzle-orm';
import webpush, { WebPushError } from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { pushSubscription, session } from '#lib/server/db/schema.ts';

/** False until all three VAPID env vars are set; then nothing can be sent or subscribed. */
export const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (pushConfigured) webpush.setVapidDetails(VAPID_SUBJECT!, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

/** The public key browsers need to subscribe (safe to send to the page). */
export const vapidPublicKey = pushConfigured ? VAPID_PUBLIC_KEY! : null;

export type PushPayload = {
	title: string;
	body: string;
	/** Where tapping the notification goes, e.g. "/transactions". */
	url?: string;
	/** Notifications with the same tag replace each other instead of stacking. */
	tag?: string;
};

// ---------------------------------------------------------------------------
// Devices

/**
 * The user's devices with notifications on, oldest first. `signedIn` is false for a device whose
 * session has ended: nothing is sent to it until the user signs in there again.
 */
export async function listDevices(userId: string) {
	const now = Date.now();
	const rows = await db
		.select({
			id: pushSubscription.id,
			endpoint: pushSubscription.endpoint,
			label: pushSubscription.label,
			createdAt: pushSubscription.createdAt,
			sessionExpiresAt: session.expiresAt
		})
		.from(pushSubscription)
		.leftJoin(session, eq(pushSubscription.sessionId, session.id))
		.where(eq(pushSubscription.userId, userId))
		.orderBy(pushSubscription.createdAt);
	return rows.map(({ sessionExpiresAt, ...device }) => ({
		...device,
		signedIn: sessionExpiresAt !== null && sessionExpiresAt.getTime() > now
	}));
}

/**
 * Saves a device. The endpoint is unique, so if this browser was turned on by another account,
 * it moves to this one (and the other account stops getting notifications here).
 */
export async function saveDevice(
	userId: string,
	sessionId: string,
	device: { endpoint: string; p256dh: string; auth: string; label: string }
) {
	await db
		.insert(pushSubscription)
		.values({ userId, sessionId, ...device })
		.onConflictDoUpdate({
			target: pushSubscription.endpoint,
			set: { userId, sessionId, p256dh: device.p256dh, auth: device.auth, label: device.label }
		});
}

/**
 * Called when a signed-in page loads on a browser that still has a subscription (e.g. after the
 * session expired and the user signed in again).
 * - Same account as before: linked to this session, so notifications resume. Returns 'linked'.
 * - Another account: the old account's device is removed (it shouldn't start getting this
 *   account's notifications without asking). Returns 'dropped'; the page then unsubscribes.
 * - Not saved at all (removed from the device list elsewhere): left alone. Returns 'unknown'.
 */
export async function linkDevice(
	userId: string,
	sessionId: string,
	device: { endpoint: string; p256dh: string; auth: string }
): Promise<'linked' | 'dropped' | 'unknown'> {
	const [row] = await db
		.select({ userId: pushSubscription.userId })
		.from(pushSubscription)
		.where(eq(pushSubscription.endpoint, device.endpoint))
		.limit(1);
	if (!row) return 'unknown';
	if (row.userId !== userId) {
		await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, device.endpoint));
		return 'dropped';
	}
	await db
		.update(pushSubscription)
		.set({ sessionId, p256dh: device.p256dh, auth: device.auth })
		.where(eq(pushSubscription.endpoint, device.endpoint));
	return 'linked';
}

/** Removes one of the user's devices, by endpoint (this device) or id (from the list). */
export async function removeDevice(userId: string, by: { endpoint: string } | { id: string }) {
	const match =
		'endpoint' in by ? eq(pushSubscription.endpoint, by.endpoint) : eq(pushSubscription.id, by.id);
	await db.delete(pushSubscription).where(and(match, eq(pushSubscription.userId, userId)));
}

// ---------------------------------------------------------------------------
// Sending

/**
 * Sends to every device the user turned on (or only `only.endpoint`, which must be theirs), all
 * at once. Devices the push service reports as gone (404/410: app removed, permission revoked)
 * are deleted. Returns how many were sent, failed and removed.
 */
export async function notify(userId: string, payload: PushPayload, only?: { endpoint: string }) {
	return notifyMany([{ userId, payload }], only);
}

/** At most this many pushes in flight at once. */
const SEND_CONCURRENCY = 10;

/**
 * Sends several messages, each to all of its user's devices: one query for every user's
 * devices, then all sends in parallel (a few at a time), then one delete for devices that are
 * gone. Used by the scheduled tick to send everyone's reminders together.
 */
export async function notifyMany(
	messages: { userId: string; payload: PushPayload }[],
	only?: { endpoint: string }
) {
	if (!pushConfigured || messages.length === 0) return { sent: 0, failed: 0, removed: 0 };
	const userIds = [...new Set(messages.map((m) => m.userId))];
	// Only devices still signed in (see the note at the top).
	const devices = (
		await db
			.select()
			.from(pushSubscription)
			.innerJoin(session, eq(pushSubscription.sessionId, session.id))
			.where(
				and(
					inArray(pushSubscription.userId, userIds),
					// Linked (the inner join) and not expired, as of now.
					gt(session.expiresAt, new Date()),
					only ? eq(pushSubscription.endpoint, only.endpoint) : undefined
				)
			)
	).map((r) => r.push_subscription);

	const jobs = messages.flatMap((m) =>
		devices
			.filter((d) => d.userId === m.userId)
			.map((device) => ({ device, body: JSON.stringify(m.payload) }))
	);
	const results = await settleLimited(
		jobs.map(
			({ device, body }) =>
				() =>
					webpush.sendNotification(
						{ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
						body,
						// Keep trying to deliver for a day (e.g. a phone that's off), then give up.
						{ TTL: 60 * 60 * 24, urgency: 'normal' }
					)
		),
		SEND_CONCURRENCY
	);

	const gone = new Set<string>();
	let sent = 0;
	let failed = 0;
	results.forEach((result, i) => {
		if (result.status === 'fulfilled') return sent++;
		const status = result.reason instanceof WebPushError ? result.reason.statusCode : null;
		if (status === 404 || status === 410) gone.add(jobs[i].device.id);
		else {
			failed++;
			console.error('Push failed', status, jobs[i].device.label, result.reason);
		}
	});
	if (gone.size > 0)
		await db.delete(pushSubscription).where(inArray(pushSubscription.id, [...gone]));
	return { sent, failed, removed: gone.size };
}

/** Like Promise.allSettled over task functions, running at most `limit` at a time. */
async function settleLimited<T>(tasks: (() => Promise<T>)[], limit: number) {
	const results: PromiseSettledResult<T>[] = new Array(tasks.length);
	let next = 0;
	const worker = async () => {
		while (next < tasks.length) {
			const i = next++;
			try {
				results[i] = { status: 'fulfilled', value: await tasks[i]() };
			} catch (reason) {
				results[i] = { status: 'rejected', reason };
			}
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
	return results;
}

// ---------------------------------------------------------------------------
// Helpers

/** "iPhone · Safari", "Mac · Chrome", from a user agent string. Good enough to tell devices apart. */
export function deviceLabel(userAgent: string | null): string {
	const ua = userAgent ?? '';
	const device = /iPhone/.test(ua)
		? 'iPhone'
		: /iPad/.test(ua)
			? 'iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Macintosh/.test(ua)
					? 'Mac'
					: /Windows/.test(ua)
						? 'Windows'
						: /Linux/.test(ua)
							? 'Linux'
							: 'Device';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\/|FxiOS/.test(ua)
			? 'Firefox'
			: /Chrome\/|CriOS/.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: 'Browser';
	return `${device} · ${browser}`;
}
