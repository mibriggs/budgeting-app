import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// Signing out is a POST from any page (the user menu posts here). Visiting /sign-out directly
// does nothing and goes home, so a link or prefetch can't sign anyone out.
export const load: PageServerLoad = () => redirect(302, '/');

export const actions: Actions = {
	default: async ({ request }) => {
		await auth.api.signOut({ headers: request.headers });
		return redirect(302, '/login');
	}
};
