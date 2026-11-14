import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth, googleEnabled } from '#lib/server/auth.ts';

/**
 * Messages for the `?error=` code Better Auth adds when it sends someone back here after a
 * failed sign-in (see `errorCallbackURL` below). Unknown codes get the generic message.
 */
const CALLBACK_ERRORS: Record<string, string> = {
	access_denied: 'Sign-in was cancelled.',
	account_not_linked:
		'An account with this email already exists but couldn’t be linked. Sign in the way you did before.',
	email_not_found: 'That account has no email address we can use.'
};

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) {
		return redirect(302, '/');
	}
	const code = url.searchParams.get('error');
	return {
		google: googleEnabled,
		callbackError: code ? (CALLBACK_ERRORS[code] ?? 'Sign-in failed. Please try again.') : null
	};
};

async function signIn(provider: 'github' | 'google', label: string) {
	const result = await auth.api.signInSocial({
		// Failures on the provider's side come back to this page with `?error=` instead of
		// Better Auth's bare error page.
		body: { provider, callbackURL: '/', errorCallbackURL: '/login' }
	});

	if (result.url) {
		return redirect(302, result.url, { external: true });
	}
	return fail(400, { message: `${label} sign-in failed. Please try again.` });
}

export const actions: Actions = {
	signInWithGitHub: () => signIn('github', 'GitHub'),
	signInWithGoogle: () => {
		if (!googleEnabled) {
			return fail(404, { message: 'Google sign-in isn’t available.' });
		}
		return signIn('google', 'Google');
	}
};
