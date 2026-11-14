import { error, fail, redirect } from '@sveltejs/kit';
import { createToken, listTokens, revokeToken } from '#lib/server/api-token.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → Widget: make and revoke the read-only tokens a Scriptable widget uses to fetch
// this month's numbers. Every action works on the signed-in user's own tokens only.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	// The scripts call this same site (ORIGIN when set, so production gets its public address).
	return { tokens: await listTokens(locals.user.id), origin: url.origin };
};

export const actions: Actions = {
	/** Makes a token and returns it once; it's never stored or shown again. */
	create: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const name = (await request.formData()).get('name');
		const result = await createToken(locals.user.id, typeof name === 'string' ? name : '');
		if ('error' in result) return fail(400, { error: result.error });
		return { token: result.token };
	},

	revoke: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string' || !(await revokeToken(locals.user.id, id)))
			return fail(404, { error: 'That token was already revoked.' });
		return { revoked: true };
	}
};
