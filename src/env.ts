import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'The database connection string: `file:local.db` locally, `libsql://….turso.io` for a hosted Turso database.'
	},
	DATABASE_AUTH_TOKEN: {
		description:
			'Auth token for a hosted Turso database. Leave unset for a local `file:` database.',
		// Optional: unset or empty means "no token".
		schema: (value) => value || undefined
	},
	ORIGIN: {
		description:
			'The app origin, e.g. `https://centjar.vercel.app` or `http://localhost:5173`. Unset means "use the request\'s own origin".',
		// Reduced to a bare origin: Better Auth matches `/api/auth/*` by concatenating ORIGIN and
		// "/api/auth" as written, so a trailing slash ("…app/") makes every auth route 404.
		schema: (value) => {
			const trimmed = value?.trim();
			if (!trimmed) return undefined;
			try {
				return new URL(trimmed).origin;
			} catch {
				throw new Error(`ORIGIN must be a URL like https://centjar.vercel.app (got "${trimmed}")`);
			}
		}
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	GITHUB_CLIENT_ID: {
		description:
			'GitHub OAuth client ID. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).'
	},
	GITHUB_CLIENT_SECRET: {
		description:
			'GitHub OAuth client secret. See [Better Auth GitHub provider](https://www.better-auth.com/docs/authentication/github).'
	},
	// Web Push (Settings → Notifications). Generate once with `npx web-push generate-vapid-keys`.
	// All three are optional: while any is missing, notifications are off and the page says so.
	VAPID_PUBLIC_KEY: {
		description:
			'Web Push public key (from `npx web-push generate-vapid-keys`). Sent to browsers when they subscribe.',
		schema: (value) => value?.trim() || undefined
	},
	VAPID_PRIVATE_KEY: {
		description:
			'Web Push private key (from `npx web-push generate-vapid-keys`). Signs every notification; keep it secret.',
		schema: (value) => value?.trim() || undefined
	},
	VAPID_SUBJECT: {
		description:
			'A contact for push services if something goes wrong, e.g. `mailto:you@example.com`.',
		schema: (value) => value?.trim() || undefined
	}
});
