import { countPending } from '#lib/server/quick-add/inbox.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		signedIn: !!locals.user,
		timezone: locals.user?.timezone ?? null,
		// Quick add items waiting to be reviewed: the number on the user menu (every page).
		inboxCount: locals.user ? await countPending(locals.user.id) : 0
	};
};
