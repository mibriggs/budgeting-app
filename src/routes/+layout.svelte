<script lang="ts">
	import './layout.css';
	import { asset } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { online } from 'svelte/reactivity/window';
	import { Toaster } from 'svelte-sonner';
	import { theme } from '#lib/theme.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// Light/dark/system theme from the user menu; also follows the device setting on "system".
	$effect(() => theme.init());

	// Notifications follow the sign-in: if this browser still has a subscription (say the session
	// expired and the user just signed in again), link it to this session so reminders resume.
	// The server only does that for the same account; for another account it removes the old
	// device and we drop the browser's copy too. Once per app load.
	$effect(() => {
		if (!data.signedIn || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
		(async () => {
			const reg = await navigator.serviceWorker.getRegistration();
			const sub = await reg?.pushManager.getSubscription();
			const keys = sub?.toJSON().keys;
			if (!sub || !keys?.p256dh || !keys.auth) return;
			const response = await fetch('/settings/notifications/link', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth })
			});
			if (!response.ok) return;
			const { status } = (await response.json()) as { status: string };
			if (status === 'dropped') await sub.unsubscribe();
		})().catch(() => {
			// Offline or failed; try again on the next app load.
		});
	});

	// Keep the user's saved time zone in sync with this browser so "today" and
	// "this month" match their clock. Reloads data once if it changed.
	$effect(() => {
		if (!data.signedIn) return;
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (timezone === data.timezone) return;

		fetch('/settings/timezone', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ timezone })
		})
			.then(async (response) => {
				if (response.ok) await invalidateAll();
			})
			.catch(() => {
				// Offline or failed; try again on the next page load.
			});
	});
</script>

<svelte:head>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
</svelte:head>

<!-- `online.current` is undefined during server rendering, so the banner only shows in the browser. -->
{#if online.current === false}
	<div
		class="fixed inset-x-0 top-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
		role="status"
	>
		You're offline. Showing the last saved version of this page.
	</div>
{/if}

{@render children()}

<!-- Toasts (e.g. "Added …", "Deleted …"), in the bottom-left corner on every page. Show them with
     `toast()` / `toast.success()` from 'svelte-sonner'. Follows the chosen light/dark theme. -->
<Toaster position="bottom-left" theme={theme.choice} richColors closeButton duration={5000} />
