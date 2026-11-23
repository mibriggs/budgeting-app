// Quick add in the browser: send a paste to the inbox and tell the user when it's been read.
// A paste with several alerts or notes becomes several items, announced together.
//
// The sheet closes as soon as sendQuickAdd starts. A "Reading…" toast shows while the server
// reads it, then turns into the result with a Review button (to /inbox). The server also pushes
// to every device with notifications on; where the app is open, the service worker passes that
// to the page instead of showing a notification, and showQuickAddReady ignores it here when the
// toast is already showing.

import { toast } from 'svelte-sonner';
import { goto, invalidateAll } from '$app/navigation';
import { resolve } from '$app/paths';

/** Batches already announced, so the push and the response don't both make a toast. */
const announced = new Set<string>();

/** The finished toast: what was read, and Review to open the inbox. Shown once per batch. */
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
		// A batch lists one item per line (for the push); a toast shows it on one line.
		description: item.body.split('\n').join('; '),
		duration: 10_000,
		action: { label: 'Review', onClick: () => goto(resolve('/inbox')) }
	});
	invalidateAll();
}

let sending = 0;

/** Sends a paste (one or more alerts or notes) to the inbox; reports back with toasts. */
export async function sendQuickAdd(message: string) {
	const loadingId = `quick-add-sending-${++sending}`;
	toast.loading('Reading…', { id: loadingId });
	try {
		const response = await fetch('/quick-add', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message })
		});
		const body = await response.json().catch(() => null);
		if (!response.ok || !body?.key) {
			toast.error(body?.message ?? 'Couldn’t save that to the inbox. Please try again.', {
				id: loadingId
			});
			return;
		}
		// Worded and keyed like the push for the same batch, so only one of them shows.
		showQuickAddReady({ id: body.key, title: body.title, body: body.body }, loadingId);
	} catch {
		toast.error(
			navigator.onLine
				? 'Couldn’t reach CentJar. Please try again.'
				: 'You’re offline. Try again when you’re back online.',
			{ id: loadingId }
		);
	}
}
