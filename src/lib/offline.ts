// Shared between the app and the service worker (src/service-worker/index.ts).

/** Prefix for the service worker's cache of pages and page data. They can contain user data. */
export const PAGE_CACHE_PREFIX = 'pages-';

/** Prefix for the service worker's cache of build output and static files. */
export const STATIC_CACHE_PREFIX = 'static-';

/**
 * Removes cached pages so the next person on this device can't read the
 * previous user's data offline. Call this when signing out.
 */
export async function clearPageCaches() {
	if (!('caches' in globalThis)) return;
	const keys = await caches.keys();
	await Promise.all(
		keys.filter((key) => key.startsWith(PAGE_CACHE_PREFIX)).map((key) => caches.delete(key))
	);
}
