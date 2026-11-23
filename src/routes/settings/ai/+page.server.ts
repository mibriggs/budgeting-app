import { error, fail, redirect } from '@sveltejs/kit';
import { createToken, listTokens, revokeToken } from '#lib/server/api-token.ts';
import { modelAvailable } from '#lib/server/quick-add/claude.ts';
import { MAX_MESSAGES } from '#lib/quick-add/parse.ts';
import {
	claudeReadingsToday,
	MAX_PENDING,
	SENDS_PER_MINUTE,
	SENDS_PER_SECOND
} from '#lib/server/quick-add/inbox.ts';
import type { Actions, PageServerLoad } from './$types';

// Settings → AI: the account's opt-in for Claude in Quick add, whether the server can use it,
// how many of today's Claude readings are used, and the Quick add tokens automations use to send
// to the inbox (POST /api/quick-add). The switch saves through ./+server.ts; the tokens through
// the actions below, on the signed-in user's own Quick add tokens only.
export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	const [readings, tokens] = await Promise.all([
		claudeReadingsToday(locals.user),
		listTokens(locals.user.id, 'quick-add')
	]);
	return {
		aiEnabled: locals.user.aiEnabled ?? false,
		modelAvailable: modelAvailable(),
		readings,
		tokens,
		limits: {
			perSecond: SENDS_PER_SECOND,
			perMinute: SENDS_PER_MINUTE,
			perRequest: MAX_MESSAGES,
			inbox: MAX_PENDING
		},
		// The example request calls this same site (ORIGIN when set, so production gets its
		// public address).
		origin: url.origin
	};
};

export const actions: Actions = {
	/** Makes a Quick add token and returns it once; it's never stored or shown again. */
	create: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const name = (await request.formData()).get('name');
		const result = await createToken(
			locals.user.id,
			'quick-add',
			typeof name === 'string' ? name : ''
		);
		if ('error' in result) return fail(400, { error: result.error });
		return { token: result.token };
	},

	revoke: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');
		const id = (await request.formData()).get('id');
		if (typeof id !== 'string' || !(await revokeToken(locals.user.id, 'quick-add', id)))
			return fail(404, { error: 'That token was already revoked.' });
		return { revoked: true };
	}
};
