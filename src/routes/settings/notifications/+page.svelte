<!--
	Settings → Notifications. Each browser on each device is turned on separately: the switch
	shows whether *this* browser has a push subscription saved on the account, asks for
	permission only when tapped, and saves or removes it. Below: test sends (this device or all)
	and the list of devices with notifications on.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Switch } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import Send from '@lucide/svelte/icons/send';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// What this browser can do, worked out once the page is in the browser.
	type Status =
		| 'checking'
		| 'unsupported' // no push in this browser
		| 'install' // iPhone/iPad Safari: only the Home Screen app can get notifications
		| 'denied' // blocked in the browser or phone settings
		| 'ready'; // can be turned on or off
	let status = $state<Status>('checking');
	/** This browser's push address, if it has one. */
	let endpoint = $state<string | null>(null);
	let working = $state(false);

	const isAppleMobile = () =>
		/iPhone|iPad|iPod/.test(navigator.userAgent) ||
		(navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
	const isInstalled = () =>
		matchMedia('(display-mode: standalone)').matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true;

	/** The service worker, or null if it doesn't become ready (e.g. some dev setups). */
	async function registration() {
		const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
		return Promise.race([navigator.serviceWorker.ready, timeout]);
	}

	onMount(async () => {
		if (
			!('serviceWorker' in navigator) ||
			!('PushManager' in window) ||
			!('Notification' in window)
		) {
			status = isAppleMobile() && !isInstalled() ? 'install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			status = 'denied';
			return;
		}
		const reg = await registration();
		if (!reg) {
			status = 'unsupported';
			return;
		}
		endpoint = (await reg.pushManager.getSubscription())?.endpoint ?? null;
		status = 'ready';
	});

	// On when this browser's subscription is saved on the account. Follows the list, so removing
	// this device from another one shows it off here too.
	const on = $derived(
		status === 'ready' && endpoint !== null && data.devices.some((d) => d.endpoint === endpoint)
	);

	/** Posts to one of this page's actions; returns the result data or shows an error. */
	async function post(action: string, fields: Record<string, string>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		try {
			const response = await fetch(`?/${action}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				await invalidateAll();
				return result.data ?? {};
			}
			toast.error(
				result.type === 'failure'
					? String(result.data?.message ?? 'Something went wrong.')
					: 'Something went wrong. Please try again.'
			);
		} catch {
			toast.error(navigator.onLine ? 'Something went wrong. Please try again.' : 'You’re offline.');
		}
		return null;
	}

	/** "BEl6…" (base64url) → bytes, as the browser wants the server's key. */
	function keyBytes(base64url: string) {
		const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
			.replaceAll('-', '+')
			.replaceAll('_', '/');
		return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
	}
	const sameKey = (a: ArrayBuffer | null, b: Uint8Array) =>
		a !== null && a.byteLength === b.byteLength && new Uint8Array(a).every((x, i) => x === b[i]);

	async function turnOn() {
		if (!data.publicKey) return;
		working = true;
		try {
			// First thing in the tap: iPhones only show the permission prompt from a direct tap.
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				if (permission === 'denied') status = 'denied';
				return;
			}
			const reg = await registration();
			if (!reg) {
				status = 'unsupported';
				return;
			}
			const key = keyBytes(data.publicKey);
			let sub = await reg.pushManager.getSubscription();
			// A subscription made with different keys (e.g. after they changed) can't be used.
			if (sub && !sameKey(sub.options.applicationServerKey, key)) {
				await sub.unsubscribe();
				sub = null;
			}
			sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
			const keys = sub.toJSON().keys ?? {};
			const saved = await post('subscribe', {
				endpoint: sub.endpoint,
				p256dh: keys.p256dh ?? '',
				auth: keys.auth ?? ''
			});
			if (saved) {
				endpoint = sub.endpoint;
				toast.success('Notifications are on for this device.');
			}
		} catch (err) {
			console.error(err);
			toast.error('Couldn’t turn notifications on in this browser.');
		} finally {
			working = false;
		}
	}

	async function turnOff() {
		working = true;
		try {
			const reg = await registration();
			const sub = await reg?.pushManager.getSubscription();
			const current = sub?.endpoint ?? endpoint;
			await sub?.unsubscribe();
			if (current && (await post('unsubscribe', { endpoint: current }))) {
				endpoint = null;
				toast.success('Notifications are off for this device.');
			}
		} finally {
			working = false;
		}
	}

	async function sendTest(scope: 'this' | 'all') {
		working = true;
		const result = (await post('test', { scope, endpoint: endpoint ?? '' })) as {
			tested?: { sent: number; failed: number; removed: number };
		} | null;
		working = false;
		const t = result?.tested;
		if (!t) return;
		if (t.sent > 0)
			toast.success(
				scope === 'this'
					? 'Test sent to this device.'
					: `Test sent to ${t.sent} ${t.sent === 1 ? 'device' : 'devices'}.`,
				{
					description:
						[
							t.removed &&
								`${t.removed} old ${t.removed === 1 ? 'device was' : 'devices were'} removed.`,
							t.failed && `${t.failed} couldn’t be reached.`
						]
							.filter(Boolean)
							.join(' ') || undefined
				}
			);
		else toast.error('The test couldn’t be delivered. Try turning notifications off and on again.');
	}

	async function removeListed(id: string, deviceEndpoint: string) {
		working = true;
		// Removing this browser from the list also turns it off here.
		if (deviceEndpoint === endpoint) {
			const reg = await registration();
			await (await reg?.pushManager.getSubscription())?.unsubscribe();
			endpoint = null;
		}
		if (await post('remove', { id })) toast.success('Device removed.');
		working = false;
	}

	const added = (date: Date) =>
		date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

	const button =
		'flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800';
</script>

<svelte:head>
	<title>Notifications · Settings · Budget</title>
</svelte:head>

<section aria-labelledby="section-title">
	<h2 id="section-title" class="text-lg font-semibold">Notifications</h2>
	<p class="text-sm text-gray-500 dark:text-gray-400">
		Get notifications on this device, even when the app is closed. Each device is turned on
		separately.
	</p>

	{#if !data.configured}
		<p
			class="mt-4 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700"
		>
			Notifications aren’t set up on the server yet (the VAPID keys are missing).
		</p>
	{:else}
		<!-- This device -->
		<div class="mt-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
			<div class="flex items-start gap-3">
				<Switch.Root
					id="this-device"
					bind:checked={() => on, (next) => (next ? turnOn() : turnOff())}
					disabled={working || status !== 'ready'}
					aria-describedby="this-device-status"
					class="mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 disabled:opacity-50 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700"
				>
					<Switch.Thumb
						class="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-gray-900"
					/>
				</Switch.Root>
				<div class="min-w-0 flex-1">
					<label for="this-device" class="text-sm font-medium">Notifications on this device</label>
					<div id="this-device-status" class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
						{#if status === 'checking'}
							Checking this browser…
						{:else if status === 'ready' && on}
							On. You’ll get notifications here.
						{:else if status === 'ready'}
							Off. Turning it on asks your browser for permission.
						{:else if status === 'install'}
							On iPhone and iPad, notifications only work in the app on your Home Screen. In Safari,
							tap <span class="font-medium text-gray-700 dark:text-gray-300">Share</span>, then
							<span class="font-medium text-gray-700 dark:text-gray-300">Add to Home Screen</span>,
							then open Budget from your Home Screen and come back here. (Needs iOS 16.4 or later.)
						{:else if status === 'denied'}
							Notifications are blocked for this site. To allow them: on iPhone, open the
							<span class="font-medium text-gray-700 dark:text-gray-300">Settings</span> app → Notifications
							→ Budget; in Chrome or Edge, click the icon at the left of the address bar → Notifications;
							in Safari on Mac, Safari → Settings → Websites → Notifications. Then reload this page.
						{:else}
							This browser doesn’t support notifications.
						{/if}
					</div>
				</div>
			</div>

			<div class="mt-4 flex flex-wrap gap-2">
				<button
					type="button"
					class={button}
					disabled={working || !on}
					onclick={() => sendTest('this')}
				>
					<Send class="size-4" aria-hidden="true" />
					Send test to this device
				</button>
				<button
					type="button"
					class={button}
					disabled={working || data.devices.length === 0}
					onclick={() => sendTest('all')}
				>
					<Send class="size-4" aria-hidden="true" />
					Send test to all devices
				</button>
			</div>
		</div>

		<!-- Devices -->
		<h3 class="mt-6 text-sm font-medium text-gray-500 dark:text-gray-400">
			Devices with notifications on · {data.devices.length}
		</h3>
		{#if data.devices.length === 0}
			<p
				class="mt-2 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700"
			>
				None yet.
			</p>
		{:else}
			<ul
				class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
			>
				{#each data.devices as device (device.id)}
					{@const isThis = device.endpoint === endpoint}
					<li class="flex items-center gap-3 px-3 py-2.5">
						<Smartphone class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="flex items-center gap-2 text-sm">
								<span class="truncate">{device.label}</span>
								{#if isThis}
									<span
										class="rounded-full bg-gray-100 px-1.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
									>
										This device
									</span>
								{/if}
							</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								Added {added(device.createdAt)}
							</span>
						</div>
						<button
							type="button"
							disabled={working}
							onclick={() => removeListed(device.id, device.endpoint)}
							class="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-red-700 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-red-400"
							aria-label="Remove {device.label}{isThis ? ' (this device)' : ''}"
						>
							Remove
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
			What you’ll get: a reminder the day before and the day each recurring expense is due, at the
			time you pick for it in Settings → Recurring.
		</p>
	{/if}
</section>
