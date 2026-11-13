// Web Push: saving the devices that turned notifications on, and sending to them.
//
// Each device's browser gives us a subscription (a unique endpoint URL at Apple's, Google's or
// Mozilla's push service, plus keys to encrypt to it). notify() signs each message with our
// VAPID keys and sends it there; the push service delivers it even when the app is closed, and
// the service worker (src/service-worker/index.ts) shows it. No third-party account involved.

import { and, eq, inArray } from 'drizzle-orm';
import webpush, { WebPushError } from 'web-push';
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from '$app/env/private';
import { db } from '#lib/server/db/index.ts';
import { pushSubscription } from '#lib/server/db/schema.ts';

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

/** The user's devices with notifications on, newest first. */
export function listDevices(userId: string) {
	return db
		.select({
			id: pushSubscription.id,
			endpoint: pushSubscription.endpoint,
			label: pushSubscription.label,
			createdAt: pushSubscription.createdAt
		})
		.from(pushSubscription)
		.where(eq(pushSubscription.userId, userId))
		.orderBy(pushSubscription.createdAt);
}

/**
 * Saves a device. The endpoint is unique, so if this browser was turned on by another account,
 * it moves to this one (and the other account stops getting notifications here).
 */
export async function saveDevice(
	userId: string,
	device: { endpoint: string; p256dh: string; auth: string; label: string }
) {
	await db
		.insert(pushSubscription)
		.values({ userId, ...device })
		.onConflictDoUpdate({
			target: pushSubscription.endpoint,
			set: { userId, p256dh: device.p256dh, auth: device.auth, label: device.label }
		});
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
	if (!pushConfigured) return { sent: 0, failed: 0, removed: 0 };
	const devices = await db
		.select()
		.from(pushSubscription)
		.where(
			and(
				eq(pushSubscription.userId, userId),
				only ? eq(pushSubscription.endpoint, only.endpoint) : undefined
			)
		);

	const body = JSON.stringify(payload);
	const results = await Promise.allSettled(
		devices.map((d) =>
			webpush.sendNotification(
				{ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
				body,
				// Keep trying to deliver for a day (e.g. a phone that's off), then give up.
				{ TTL: 60 * 60 * 24, urgency: 'normal' }
			)
		)
	);

	const gone: string[] = [];
	let sent = 0;
	let failed = 0;
	results.forEach((result, i) => {
		if (result.status === 'fulfilled') return sent++;
		const status = result.reason instanceof WebPushError ? result.reason.statusCode : null;
		if (status === 404 || status === 410) gone.push(devices[i].id);
		else {
			failed++;
			console.error('Push failed', status, devices[i].label, result.reason);
		}
	});
	if (gone.length > 0) await db.delete(pushSubscription).where(inArray(pushSubscription.id, gone));
	return { sent, failed, removed: gone.length };
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
