import { redirect } from '@sveltejs/kit';
import { displayName } from '#lib/server/user.ts';
import type { PageServerLoad } from './$types';

// Settings page: a stub for now (reached from the user menu).
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}
	return {
		displayName: displayName(locals.user)
	};
};
