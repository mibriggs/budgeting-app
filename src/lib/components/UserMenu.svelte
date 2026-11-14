<!--
	@component
	Avatar icon + name that opens a menu with Transactions, Settings, a Light/Dark/System theme
	picker and Sign Out. Works on any page:
	signing out posts to /sign-out and clears the offline page cache first. It also turns off this
	device's notifications, so whoever signs in next on this browser doesn't get them.
-->
<script lang="ts">
	import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Monitor from '@lucide/svelte/icons/monitor';
	import Moon from '@lucide/svelte/icons/moon';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import Sun from '@lucide/svelte/icons/sun';
	import { DropdownMenu } from 'bits-ui';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { createMediaQuery, LARGE_SCREEN } from '#lib/media.svelte.ts';
	import { clearPageCaches } from '#lib/offline.ts';
	import { theme, type ThemeChoice } from '#lib/theme.svelte.ts';

	let { name }: { name: string } = $props();

	// Large screens have no Settings overview (the sidebar replaces it), so link to Budgets.
	const large = createMediaQuery(LARGE_SCREEN);

	let signOutForm = $state<HTMLFormElement | null>(null);

	/** This browser's push subscription, if notifications are on here (removed on sign-out). */
	async function pushSubscription() {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
		const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
		const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
		return (await reg?.pushManager.getSubscription()) ?? null;
	}
	let pushEndpoint = $state('');
	// Looked up ahead of time: the sign-out form's submit handler can't wait for it.
	$effect(() => {
		pushSubscription().then((sub) => (pushEndpoint = sub?.endpoint ?? ''));
	});

	const themeOptions: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'Match system', icon: Monitor }
	];

	const item =
		'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-none select-none data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800';
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-gray-100 data-[state=open]:bg-gray-100 dark:hover:bg-gray-800 dark:data-[state=open]:bg-gray-800"
	>
		<CircleUserRound class="size-5 shrink-0" aria-hidden="true" />
		<span class="max-w-40 truncate">{name}</span>
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content
			align="end"
			sideOffset={8}
			collisionPadding={8}
			class="z-50 min-w-44 rounded-lg border border-gray-200 bg-white p-1 text-gray-900 shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<DropdownMenu.Item class={item}>
				{#snippet child({ props })}
					<a href={resolve('/transactions')} {...props}>
						<ReceiptText class="size-4" aria-hidden="true" />
						Transactions
					</a>
				{/snippet}
			</DropdownMenu.Item>
			<DropdownMenu.Item class={item}>
				{#snippet child({ props })}
					<a href={large.current ? resolve('/settings/budgets') : resolve('/settings')} {...props}>
						<SettingsIcon class="size-4" aria-hidden="true" />
						Settings
					</a>
				{/snippet}
			</DropdownMenu.Item>
			<DropdownMenu.Separator class="my-1 h-px bg-gray-200 dark:bg-gray-700" />
			<!-- Theme: stays open on pick so the change is visible; saved per device. -->
			<div class="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
				<span id="theme-label" class="text-gray-600 dark:text-gray-400">Theme</span>
				<DropdownMenu.RadioGroup
					value={theme.choice}
					onValueChange={(value) => theme.set(value as ThemeChoice)}
					aria-labelledby="theme-label"
					class="flex gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
				>
					{#each themeOptions as option (option.value)}
						<DropdownMenu.RadioItem
							value={option.value}
							closeOnSelect={false}
							aria-label={option.label}
							title={option.label}
							class="flex size-7 cursor-pointer items-center justify-center rounded text-gray-500 outline-none data-highlighted:bg-gray-100 data-[state=checked]:bg-gray-900 data-[state=checked]:text-white dark:text-gray-400 dark:data-highlighted:bg-gray-800 dark:data-[state=checked]:bg-white dark:data-[state=checked]:text-gray-900"
						>
							<option.icon class="size-4" aria-hidden="true" />
						</DropdownMenu.RadioItem>
					{/each}
				</DropdownMenu.RadioGroup>
			</div>
			<DropdownMenu.Separator class="my-1 h-px bg-gray-200 dark:bg-gray-700" />
			<DropdownMenu.Item class={item} onSelect={() => signOutForm?.requestSubmit()}>
				<LogOut class="size-4" aria-hidden="true" />
				Sign Out
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<form
	bind:this={signOutForm}
	method="post"
	action="/sign-out"
	hidden
	use:enhance={() =>
		async ({ update }) => {
			// The server removed the saved subscription; drop the browser's copy too.
			await (await pushSubscription())?.unsubscribe().catch(() => {});
			await clearPageCaches();
			await update();
		}}
>
	<input type="hidden" name="pushEndpoint" value={pushEndpoint} />
</form>
