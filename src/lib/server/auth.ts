import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.ts';
import { createDefaultCategories } from '#lib/server/budget/defaults.ts';

/** Google sign-in is offered only when both of its env vars are set. */
export const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
	baseURL: ORIGIN,
	secret: BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: { enabled: false },
	user: {
		additionalFields: {
			// GitHub login handle (e.g. "octocat"). `name` holds the display name instead.
			username: { type: 'string', required: false, input: false },
			// IANA time zone (e.g. "America/New_York") used for "today" and "this month".
			// Unset until the app records it from the browser.
			timezone: { type: 'string', required: false, input: false },
			// Home page "Credit Cards" card: shown unless the user hides it (× on the card, or
			// Settings → Payment Methods). Saved by POST /settings/home-cards.
			showCreditCards: { type: 'boolean', required: false, defaultValue: true, input: false }
		}
	},
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					await createDefaultCategories(user.id);
				}
			}
		}
	},
	socialProviders: {
		github: {
			clientId: GITHUB_CLIENT_ID,
			clientSecret: GITHUB_CLIENT_SECRET,
			mapProfileToUser: (profile) => ({ username: profile.login }),
			// Refresh name, avatar and username from GitHub on every sign-in.
			overrideUserInfoOnSignIn: true
		},
		// Signing in with Google when a GitHub account already has the same email links to that
		// account instead of making a new one: Better Auth does this by default because Google
		// reports the email as verified and GitHub accounts store it as verified. A different
		// email makes a separate account.
		...(googleEnabled && {
			google: {
				clientId: GOOGLE_CLIENT_ID!,
				clientSecret: GOOGLE_CLIENT_SECRET!,
				// Always show the account chooser, so someone with several Google accounts picks one.
				prompt: 'select_account' as const
			}
		})
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
