import { redirect } from '@sveltejs/kit';
import { modelAvailable } from '#lib/server/quick-add/claude.ts';
import { claudeReadingsToday } from '#lib/server/quick-add/inbox.ts';
import type { PageServerLoad } from './$types';

// Settings → AI: the account's opt-in for Claude in Quick add, whether the server can use it, and
// how many of today's Claude readings are used.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return {
		aiEnabled: locals.user.aiEnabled ?? false,
		modelAvailable: modelAvailable(),
		readings: await claudeReadingsToday(locals.user)
	};
};
