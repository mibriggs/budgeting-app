<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AddTransactionDialog from '#lib/components/AddTransactionDialog.svelte';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatDate } from '#lib/date-range.ts';
	import { clearPageCaches } from '#lib/offline.ts';
	import type { TransactionKind } from '#lib/server/budget/transactions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let addKind = $state<TransactionKind>('expense');
	let addOpen = $state(false);
	let status = $state('');
	let statusTimer: ReturnType<typeof setTimeout> | undefined;

	function openAdd(kind: TransactionKind) {
		addKind = kind;
		addOpen = true;
	}

	function onCreated({ name, date }: { name: string; date: PlainDate }) {
		status = `Added “${name}” on ${formatDate(date)}.`;
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => (status = ''), 6000);
	}

	const primary =
		'flex items-center justify-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
	const secondary =
		'rounded-md border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800';
</script>

<svelte:head>
	<title>Budget</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
	<h1 class="text-center text-3xl font-semibold">Welcome {data.username}</h1>

	<div class="grid w-full max-w-xs grid-cols-2 gap-3">
		<button type="button" class={primary} onclick={() => openAdd('expense')}>
			<Plus class="size-4" aria-hidden="true" />
			Expense
		</button>
		<button type="button" class={primary} onclick={() => openAdd('income')}>
			<Plus class="size-4" aria-hidden="true" />
			Income
		</button>
	</div>

	<p class="min-h-5 text-center text-sm text-gray-500" aria-live="polite">
		{#if status}
			{status}
			<a href={resolve('/transactions')} class="underline">View</a>
		{/if}
	</p>

	<a href={resolve('/transactions')} class={secondary}>View transactions</a>

	<form
		method="post"
		action="?/signOut"
		use:enhance={() =>
			async ({ update }) => {
				await clearPageCaches();
				await update();
			}}
	>
		<button class="text-sm text-gray-500 hover:underline">Sign out</button>
	</form>
</main>

<AddTransactionDialog
	bind:open={addOpen}
	kind={addKind}
	categories={data.categories[addKind]}
	today={data.today}
	action="/transactions?/create"
	{onCreated}
/>
