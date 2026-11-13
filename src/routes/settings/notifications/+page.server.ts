import { error, fail, redirect } from '@sveltejs/kit';
import {
	deviceLabel,
	listDevices,
	notify,
	pushConfigured,
	removeDevice,
	saveDevice,
	vapidPublicKey
} from '#lib/server/push.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Notifications: turn notifications on or off for this device, see and remove
// devices, and send test notifications. Every action works on the signed-in user's own devices
// only; the user always comes from the session, never from the form.

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return {
		configured: pushConfigured,
		publicKey: vapidPublicKey,
		devices: await listDevices(locals.user.id)
	};
};

const field = (form: FormData, key: string) => {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim() : '';
};

// Push services hand out https URLs; the keys are short base64url strings.
const isEndpoint = (s: string) => s.length <= 2048 && /^https:\/\/[^\s]+$/.test(s);
const isKey = (s: string) => s.length > 0 && s.length <= 256 && /^[A-Za-z0-9_-]+=*$/.test(s);

// One test per user every few seconds, so repeated taps can't flood a phone. Kept in memory:
// good enough for a soft limit (a new server instance just starts fresh).
const TEST_GAP_MS = 5_000;
const lastTest = new Map<string, number>();

export const actions: Actions = {
	/** Saves this device's subscription (after the browser granted permission). */
	subscribe: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		if (!pushConfigured) return fail(503, { message: 'Notifications aren’t set up yet.' });
		const form = await request.formData();
		const device = {
			endpoint: field(form, 'endpoint'),
			p256dh: field(form, 'p256dh'),
			auth: field(form, 'auth'),
			label: deviceLabel(request.headers.get('user-agent'))
		};
		if (!isEndpoint(device.endpoint) || !isKey(device.p256dh) || !isKey(device.auth))
			return fail(400, { message: 'This browser sent an invalid subscription.' });
		await saveDevice(locals.user.id, device);
		return { subscribed: device.label };
	},

	/** Turns this device off (the browser has already dropped its subscription). */
	unsubscribe: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const endpoint = field(await request.formData(), 'endpoint');
		if (endpoint) await removeDevice(locals.user.id, { endpoint });
		return { unsubscribed: true };
	},

	/** Removes a device from the list (e.g. an old phone). */
	remove: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const id = field(await request.formData(), 'id');
		if (id) await removeDevice(locals.user.id, { id });
		return { removed: true };
	},

	/** Sends a test to this device (`scope=this` with its endpoint) or to all the user's devices. */
	test: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		if (!pushConfigured) return fail(503, { message: 'Notifications aren’t set up yet.' });
		const form = await request.formData();
		const scope = field(form, 'scope') === 'this' ? 'this' : 'all';
		const endpoint = field(form, 'endpoint');
		if (scope === 'this' && !endpoint)
			return fail(400, { message: 'Turn notifications on for this device first.' });

		const now = Date.now();
		if (now - (lastTest.get(locals.user.id) ?? 0) < TEST_GAP_MS)
			return fail(429, { message: 'Wait a few seconds before sending another test.' });
		lastTest.set(locals.user.id, now);

		const result = await notify(
			locals.user.id,
			{
				title: 'Test notification',
				body:
					scope === 'this'
						? 'Notifications work on this device.'
						: 'Sent to all your devices with notifications on.',
				url: '/settings/notifications',
				tag: 'test'
			},
			scope === 'this' ? { endpoint } : undefined
		);
		if (result.sent === 0 && result.removed === 0 && result.failed === 0)
			return fail(400, {
				message:
					scope === 'this'
						? 'This device isn’t turned on. Turn notifications on first.'
						: 'No devices have notifications on yet.'
			});
		return { tested: { scope, ...result } };
	}
};
