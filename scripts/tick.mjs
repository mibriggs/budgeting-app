// Runs the recurring tick once against a running app, like cron-job.org does in production.
//   npm run tick                 → http://localhost:5173
//   npm run tick -- --every 60   → repeat every 60 seconds (Ctrl+C to stop)
// Uses CRON_SECRET from .env. Set TICK_URL to point at another server.

const secret = process.env.CRON_SECRET;
if (!secret) {
	console.error('CRON_SECRET is not set (add it to .env).');
	process.exit(1);
}
const url = process.env.TICK_URL ?? 'http://localhost:5173/api/cron/recurring';
const everyIndex = process.argv.indexOf('--every');
const every = everyIndex === -1 ? 0 : Number(process.argv[everyIndex + 1]);

async function tick() {
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { authorization: `Bearer ${secret}` }
		});
		console.log(new Date().toLocaleTimeString(), res.status, await res.text());
	} catch (err) {
		console.error(new Date().toLocaleTimeString(), 'failed:', err.message);
	}
}

await tick();
if (every > 0) setInterval(tick, every * 1000);
