# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv@1.3.0 create --template minimal --types ts --add prettier eslint tailwindcss="plugins:forms,typography" sveltekit-adapter="adapter:vercel" drizzle="database:sqlite+sqlite:libsql" better-auth="demo:github" --install npm ./
```

## Adding features

Add features to your project with `sv add`:

```sh
npx sv add
```

For example, to add Tailwind CSS:

```sh
npx sv add tailwindcss
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Database changes

Locally the database is the SQLite file `local.db`; in production it's a hosted [Turso](https://turso.tech) database (`DATABASE_URL=libsql://…` plus `DATABASE_AUTH_TOKEN`).

1. Change the schema in `src/lib/server/db/` (or `src/lib/server/auth.ts`, then `npm run auth:schema`).
2. `npm run db:generate` to write a migration in `drizzle/`.
3. **Read the generated SQL.** For SQLite, drizzle-kit sometimes rebuilds a whole table (create, copy, drop, rename), which can fail on foreign keys or cascade-delete rows. Replace those with an `ALTER TABLE … ADD` where possible (see `drizzle/0004_category_icons.sql`).
4. `npm run db:migrate` to apply it to `local.db`, then commit the migration.

## Deploying (Vercel)

Vercel runs `npm run vercel-build`, which calls `scripts/migrate-on-deploy.sh` and then `vite build`:

- **Production deployments** apply committed migrations to the production database before building. If a migration fails, the build fails and the previous deployment stays live.
- **Preview deployments** skip migrations, so an unmerged branch can't change production. To migrate previews, give the Preview environment its own `DATABASE_URL` and set `MIGRATE_ON_DEPLOY=true` there.
- Migrations run before the new code goes live, so the old code briefly runs against the new schema. Adding columns/tables is safe; to rename or drop a column, deploy once without using it, then remove it.

Environment variables to set in Vercel: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ORIGIN` (the production URL), `BETTER_AUTH_SECRET` (new, from `openssl rand -base64 32`), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (from a GitHub OAuth app whose callback is `https://<your-domain>/api/auth/callback/github`).
