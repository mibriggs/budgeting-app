// Showing and hiding the home page "Credit Cards" card (saved per account).

import { toast } from 'svelte-sonner';

/** Saves the choice. Returns false (and shows an error toast) if it couldn't be saved. */
export async function saveCreditCardsCard(show: boolean): Promise<boolean> {
	try {
		const response = await fetch('/settings/home-cards', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ creditCards: show })
		});
		if (response.ok) return true;
	} catch {
		// Offline or the request failed: reported below.
	}
	toast.error(
		navigator.onLine
			? 'Couldn’t save that. Please try again.'
			: "You're offline. That needs a connection."
	);
	return false;
}
