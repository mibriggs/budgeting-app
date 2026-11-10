import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET
} from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '#lib/server/db/index.ts';
import { createDefaultCategories } from '#lib/server/budget/defaults.ts';

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
			timezone: { type: 'string', required: false, input: false }
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
		}
	},
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
