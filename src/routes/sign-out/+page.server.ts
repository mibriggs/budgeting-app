import { redirect } from '@sveltejs/kit';
import { auth } from '#lib/server/auth.ts';
import { removeDevice } from '#lib/server/push.ts';
import type { Actions, PageServerLoad } from './$types';

// Signing out is a POST from any page (the user menu posts here). Visiting /sign-out directly
// does nothing and goes home, so a link or prefetch can't sign anyone out.
export const load: PageServerLoad = () => redirect(302, '/');

export const actions: Actions = {
	default: async ({ locals, request }) => {
		// Turn off notifications for this browser while we still know whose they are.
		const endpoint = (await request.formData()).get('pushEndpoint');
		if (locals.user && typeof endpoint === 'string' && endpoint)
			await removeDevice(locals.user.id, { endpoint });
		await auth.api.signOut({ headers: request.headers });
		return redirect(302, '/login');
	}
};
