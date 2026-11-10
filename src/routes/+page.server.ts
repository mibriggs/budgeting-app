import { redirect, type Actions } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import type { PageServerLoad } from './login/$types';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	return {
		// Fall back to the display name for accounts created before `username` existed.
		username: locals.user.username ?? locals.user.name
	};
};

export const actions: Actions = {
	signOut: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		return redirect(302, '/login');
	}
};
