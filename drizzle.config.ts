import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// The `turso` dialect is SQLite over libsql: it handles both a local `file:` database and a
// hosted Turso `libsql://` one (which also needs DATABASE_AUTH_TOKEN). To migrate production:
//   DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" npm run db:migrate
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'turso',
	dbCredentials: {
		url: process.env.DATABASE_URL,
		authToken: process.env.DATABASE_AUTH_TOKEN || undefined
	},
	verbose: true,
	strict: true
});
