#!/bin/sh
# Applies committed Drizzle migrations during a Vercel build, before `vite build`.
# Run by the `vercel-build` script in package.json (Vercel uses it instead of `build`).
#
# - Production deployments (VERCEL_ENV=production): always migrate.
# - Preview deployments: skipped, so an unmerged branch can't change the production database.
#   Set MIGRATE_ON_DEPLOY=true for the Preview environment in Vercel to migrate there too,
#   but only if previews use their own DATABASE_URL.
# - A failed migration exits non-zero, which fails the build; the previous deployment stays live.
#
# This only applies migrations. Generate them locally (`npm run db:generate`), review the SQL,
# and commit it.

set -eu

environment="${VERCEL_ENV:-local}"

if [ "$environment" = "production" ] || [ "${MIGRATE_ON_DEPLOY:-}" = "true" ]; then
	echo "migrate-on-deploy: applying migrations ($environment)"
	# scripts/migrate.mjs rather than `drizzle-kit migrate`, which can fail without saying why.
	if ! node scripts/migrate.mjs; then
		echo "" >&2
		echo "migrate-on-deploy: migrations FAILED (error above), so this deployment was stopped." >&2
		echo "  Check DATABASE_URL and DATABASE_AUTH_TOKEN for the $environment environment in Vercel," >&2
		echo "  then try a local run against the same database: DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run db:migrate" >&2
		exit 1
	fi
	echo "migrate-on-deploy: done"
else
	echo "migrate-on-deploy: skipping migrations ($environment; set MIGRATE_ON_DEPLOY=true to run them)"
fi
