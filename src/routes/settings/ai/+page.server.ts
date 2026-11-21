import { redirect } from '@sveltejs/kit';
import { modelAvailable } from '#lib/server/quick-add/claude.ts';
import type { PageServerLoad } from './$types';

// Settings → AI: the account's opt-in for Claude in Quick add, and whether the server can use it.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return { aiEnabled: locals.user.aiEnabled ?? false, modelAvailable: modelAvailable() };
};
