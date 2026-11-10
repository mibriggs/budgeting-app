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
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
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
	}
});
