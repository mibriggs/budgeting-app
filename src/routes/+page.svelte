<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AddTransactionDialog from '#lib/components/AddTransactionDialog.svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatDate, monthRangeParams } from '#lib/date-range.ts';
	import { updateQuery } from '#lib/url.ts';
	import type { TransactionKind } from '#lib/server/budget/transactions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let addKind = $state<TransactionKind>('expense');
	let addOpen = $state(false);

	function openAdd(kind: TransactionKind) {
		addKind = kind;
		addOpen = true;
	}

	function onCreated({ name, date }: { name: string; date: PlainDate }) {
		const kind = addKind;
		toast.success(`Added “${name}”.`, {
			description: formatDate(date),
			// Opens the right tab, on the month the new entry is in.
			action: {
				label: 'View',
				onClick: () =>
					goto(
						resolve(
							`/transactions${updateQuery('', {
								...monthRangeParams(date, data.today),
								tab: kind === 'income' ? 'income' : null
							})}`
						)
					)
			}
		});
	}

	const primary =
		'flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
	const secondary =
		'rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800';
</script>

<svelte:head>
	<title>Budget</title>
</svelte:head>

<AppHeader name={data.displayName} home />

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<!-- Quick actions, left-aligned at the top (under "Budget"). Wraps onto two lines on narrow phones. -->
	<div class="flex flex-wrap items-center justify-start gap-3">
		<button type="button" class={primary} onclick={() => openAdd('expense')}>
			<Plus class="size-4" aria-hidden="true" />
			Expense
		</button>
		<button type="button" class={primary} onclick={() => openAdd('income')}>
			<Plus class="size-4" aria-hidden="true" />
			Income
		</button>
		<a href={resolve('/transactions')} class={secondary}>View transactions</a>
	</div>
</main>

<AddTransactionDialog
	bind:open={addOpen}
	kind={addKind}
	categories={data.categories[addKind]}
	today={data.today}
	action="/transactions?/create"
	{onCreated}
/>
