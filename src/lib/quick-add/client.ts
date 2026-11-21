// Quick add in the browser: send a message to the inbox and tell the user when it's been read.
//
// The sheet closes as soon as sendQuickAdd starts. A "Reading…" toast shows while the server
// reads it, then turns into the result with a Review button (to /inbox). The server also pushes
// to this device; if the app is open, the service worker passes that to the page instead of
// showing a notification, and showQuickAddReady ignores it when the toast is already showing.

import { toast } from 'svelte-sonner';
import { goto, invalidateAll } from '$app/navigation';
import { resolve } from '$app/paths';

/** Items already announced, so the push and the response don't both make a toast. */
const announced = new Set<string>();

/** This device's push address, if notifications are on here (so only it gets the push). */
async function pushEndpoint(): Promise<string | undefined> {
	try {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return undefined;
		const registration = await navigator.serviceWorker.getRegistration();
		return (await registration?.pushManager.getSubscription())?.endpoint;
	} catch {
		return undefined;
	}
}

/** The finished toast: what was read, and Review to open the inbox. Shown once per item. */
export function showQuickAddReady(
	item: { id: string; title: string; body: string },
	replace?: string
) {
	// The "Reading…" toast goes either way, even if the push already announced this item.
	if (replace) toast.dismiss(replace);
	if (announced.has(item.id)) return;
	announced.add(item.id);
	toast(item.title, {
		id: `quick-add-${item.id}`,
		description: item.body,
		duration: 10_000,
		action: { label: 'Review', onClick: () => goto(resolve('/inbox')) }
	});
	invalidateAll();
}

let sending = 0;

/** Sends a pasted alert or typed note to the inbox; reports back with toasts. */
export async function sendQuickAdd(message: string) {
	const loadingId = `quick-add-sending-${++sending}`;
	toast.loading('Reading your expense…', { id: loadingId });
	try {
		const response = await fetch('/quick-add', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message, pushEndpoint: await pushEndpoint() })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok || !body?.item) {
			toast.error(body?.message ?? 'Couldn’t save that to the inbox. Please try again.', {
				id: loadingId
			});
			return;
		}
		const item = body.item as { id: string; status: string; summary: string };
		showQuickAddReady(
			{
				id: item.id,
				title: item.status === 'failed' ? 'Quick add needs a hand' : 'Ready to review',
				body: item.summary
			},
			loadingId
		);
	} catch {
		toast.error(
			navigator.onLine
				? 'Couldn’t reach CentJar. Please try again.'
				: 'You’re offline. Try again when you’re back online.',
			{ id: loadingId }
		);
	}
}
