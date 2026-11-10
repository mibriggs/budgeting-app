import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.ts';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	signInWithGitHub: async () => {
		const result = await auth.api.signInSocial({
			body: { provider: 'github', callbackURL: '/' }
		});

		if (result.url) {
			return redirect(302, result.url, { external: true });
		}
		return fail(400, { message: 'GitHub sign-in failed. Please try again.' });
	}
};
