// Offline support. SvelteKit registers this service worker automatically.
//
// Strategy:
// - Build output and files in /static are precached on install and served cache-first.
//   Both caches are versioned, so each deploy replaces them.
// - Page navigations and SvelteKit data requests (__data.json) go to the network first.
//   Successful responses are saved, and the saved copy is used when the network fails.
// - /api/* (Better Auth) and non-GET requests always go to the network.
//
// Push notifications (Settings → Notifications): `push` shows what the server sent (see
// src/lib/server/push.ts); tapping it focuses an open window of the app, or opens one.

import { self } from '$app/service-worker';
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { PAGE_CACHE_PREFIX, STATIC_CACHE_PREFIX } from '#lib/offline.ts';

const STATIC_CACHE = `${STATIC_CACHE_PREFIX}${version}`;
const PAGE_CACHE = `${PAGE_CACHE_PREFIX}${version}`;

// Manifest paths are relative to the app's base path; resolve them against the
// service worker's scope so they work with or without a leading slash.
const scope = new URL(self.registration.scope);
const toUrl = (path: string) => new URL(path.replace(/^\/+/, ''), scope).href;

const PRECACHE_URLS = [...immutable, ...assets, ...prerendered].map(({ path }) => toUrl(path));
const precached = new Set(PRECACHE_URLS);

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(STATIC_CACHE);
			await cache.addAll(PRECACHE_URLS);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop caches from previous versions. Their pages point at JS/CSS files
			// that no longer exist, so they can't be rendered anyway.
			for (const key of await caches.keys()) {
				if (key !== STATIC_CACHE && key !== PAGE_CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.startsWith(`${scope.pathname}api/`)) return;

	if (precached.has(url.href)) {
		event.respondWith(cacheFirst(request));
	} else if (request.mode === 'navigate' || url.pathname.endsWith('/__data.json')) {
		event.respondWith(networkFirst(request));
	}
});

type PushPayload = { title: string; body: string; url?: string; tag?: string };

self.addEventListener('push', (event) => {
	let payload: PushPayload;
	try {
		payload = event.data?.json() as PushPayload;
	} catch {
		payload = { title: 'Budget', body: event.data?.text() ?? '' };
	}
	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag,
			icon: toUrl('icons/icon-192.png'),
			badge: toUrl('icons/icon-192.png'),
			data: { url: payload.url ?? '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target = new URL((event.notification.data as { url?: string })?.url ?? '/', scope).href;
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
			if (open) {
				await open.focus();
				if (open.url !== target) await open.navigate(target);
			} else {
				await self.clients.openWindow(target);
			}
		})()
	);
});

async function cacheFirst(request: Request) {
	const cached = await caches.match(request, { cacheName: STATIC_CACHE });
	return cached ?? fetch(request);
}

async function networkFirst(request: Request) {
	try {
		const response = await fetch(request);

		// Only save normal 200 responses. Redirects (e.g. to /login when signed out)
		// come back as `opaqueredirect` for navigations and are skipped.
		if (response.ok && response.type === 'basic') {
			const cache = await caches.open(PAGE_CACHE);
			await cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cached = await caches.match(request, { cacheName: PAGE_CACHE });
		if (cached) return cached;
		if (request.mode === 'navigate') return offlinePage();
		throw error;
	}
}

function offlinePage() {
	const html = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="theme-color" content="#166534" />
	<title>Offline · Budget</title>
	<style>
		body { margin: 0; min-height: 100dvh; display: grid; place-items: center; font-family: system-ui, sans-serif; color: #111827; background: #fff; text-align: center; padding: 1.5rem; box-sizing: border-box; }
		@media (prefers-color-scheme: dark) { body { color: #f3f4f6; background: #030712; } }
		h1 { font-size: 1.5rem; margin: 0 0 0.5rem; }
		p { margin: 0 0 1.5rem; color: #6b7280; }
		a { color: inherit; border: 1px solid currentColor; border-radius: 0.375rem; padding: 0.5rem 1rem; text-decoration: none; }
	</style>
</head>
<body>
	<main>
		<h1>You're offline</h1>
		<p>This page hasn't been saved for offline use yet.</p>
		<a href="">Try again</a>
	</main>
</body>
</html>`;

	return new Response(html, {
		status: 503,
		headers: { 'Content-Type': 'text/html; charset=utf-8' }
	});
}
