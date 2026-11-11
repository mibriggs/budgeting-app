<!--
	@component
	Avatar icon + name that opens a menu with Transactions, Settings and Sign Out. Works on any page:
	signing out posts to /sign-out and clears the offline page cache first.
-->
<script lang="ts">
	import CircleUserRound from '@lucide/svelte/icons/circle-user-round';
	import LogOut from '@lucide/svelte/icons/log-out';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import { DropdownMenu } from 'bits-ui';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { clearPageCaches } from '#lib/offline.ts';

	let { name }: { name: string } = $props();

	let signOutForm = $state<HTMLFormElement | null>(null);

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
			class="z-50 min-w-44 rounded-lg border border-gray-200 bg-white p-1 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
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
					<a href={resolve('/settings')} {...props}>
						<SettingsIcon class="size-4" aria-hidden="true" />
						Settings
					</a>
				{/snippet}
			</DropdownMenu.Item>
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
			await clearPageCaches();
			await update();
		}}
></form>
