import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Settings → Recurring: a stub for now. The plan (table, generator, reminders) is in
// .claude/future-plans.md under "Recurring expenses".
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return {};
};
