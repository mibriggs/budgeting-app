// Applies the committed migrations in drizzle/ to DATABASE_URL (plus DATABASE_AUTH_TOKEN for Turso).
//
//   npm run db:migrate                    against the database in .env (local.db)
//   DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run db:migrate   against another one
//
// Same result as `drizzle-kit migrate` (same __drizzle_migrations table), but it prints the real
// error when something goes wrong; drizzle-kit can exit with no message at all.

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL?.trim();
const authToken = process.env.DATABASE_AUTH_TOKEN?.trim() || undefined;

if (!url) {
	console.error('migrate: DATABASE_URL is not set.');
	process.exit(1);
}

// Show where we're connecting without printing credentials.
const target = url.startsWith('file:') ? url : url.replace(/^(\w+:\/\/[^/?#]+).*$/, '$1');
console.log(`migrate: ${target} (${authToken ? 'with' : 'without'} auth token)`);

if (/^(libsql|https?|wss?):/.test(url) && !authToken && !/localhost|127\.0\.0\.1/.test(url)) {
	console.warn('migrate: warning: remote database but DATABASE_AUTH_TOKEN is empty.');
}
if (/^["']|["']$/.test(url)) {
	console.warn(
		'migrate: warning: DATABASE_URL starts or ends with a quote; paste it without quotes.'
	);
}

let client;

try {
	// Inside the try: an invalid URL throws here, before any connection.
	client = createClient({ url, authToken });
	await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
	const { rows } = await client.execute('SELECT count(*) AS n FROM __drizzle_migrations');
	console.log(`migrate: up to date (${rows[0].n} migrations applied in total).`);
} catch (error) {
	console.error('migrate: FAILED');
	// libsql errors carry a code (e.g. SERVER_ERROR, SQLITE_CONSTRAINT) and often a cause.
	for (let e = error; e; e = e.cause) {
		console.error(`  ${e.code ? `[${e.code}] ` : ''}${e.message ?? e}`);
	}
	process.exitCode = 1;
} finally {
	client?.close();
}
