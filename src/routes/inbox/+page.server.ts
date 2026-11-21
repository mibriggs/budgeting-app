import { redirect } from '@sveltejs/kit';
import { displayName } from '#lib/server/user.ts';
import type { PageServerLoad } from './$types';

// Quick-add inbox. Placeholder until pasted and typed expenses can be saved for later: the user
// menu and the home page already link here.
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}
	return { displayName: displayName(locals.user) };
};
