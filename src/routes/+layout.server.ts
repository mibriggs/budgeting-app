import { countPending } from '#lib/server/quick-add/inbox.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
	// The inbox count changes outside this page: Quick add from an automation (POST /api/quick-add)
	// or another device. Reading the path makes this load run again on every navigation, like the
	// page's own load, so the count never lags the inbox list (one indexed count query). And
	// `app:inbox` lets the layout refresh it when the app comes back on screen.
	void url.pathname;
	depends('app:inbox');
	return {
		signedIn: !!locals.user,
		timezone: locals.user?.timezone ?? null,
		// Quick add items waiting to be reviewed: the number on the user menu (every page).
		inboxCount: locals.user ? await countPending(locals.user.id) : 0
	};
};
