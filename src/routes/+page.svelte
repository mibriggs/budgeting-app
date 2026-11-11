<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AddTransactionDialog from '#lib/components/AddTransactionDialog.svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import CategorySpending from '#lib/components/dashboard/CategorySpending.svelte';
	import MonthlyChart from '#lib/components/dashboard/MonthlyChart.svelte';
	import PaceChart from '#lib/components/dashboard/PaceChart.svelte';
	import StatTiles from '#lib/components/dashboard/StatTiles.svelte';
	import type { PlainDate, Temporal } from '#lib/dates.ts';
	import { formatDate, formatMonth, monthRangeParams } from '#lib/date-range.ts';
	import { updateQuery } from '#lib/url.ts';
	import type { TransactionKind } from '#lib/server/budget/transactions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const monthName = (month: Temporal.PlainYearMonth) => formatMonth(month, { year: false });
	let thisMonthLabel = $derived(formatMonth(data.dashboard.month));

	let addKind = $state<TransactionKind>('expense');
	let addOpen = $state(false);

	// One Add button; the dialog starts on Expense (the common case) and has a switch for Income.
	function openAdd() {
		addKind = 'expense';
		addOpen = true;
	}

	function onCreated({
		kind,
		name,
		date
	}: {
		kind: TransactionKind;
		name: string;
		date: PlainDate;
	}) {
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
	<!-- Quick actions, left-aligned at the top (under "Budget"). -->
	<div class="flex flex-wrap items-center justify-start gap-3">
		<button type="button" class={primary} onclick={openAdd}>
			<Plus class="size-4" aria-hidden="true" />
			Add
		</button>
		<a href={resolve('/transactions')} class={secondary}>View transactions</a>
	</div>

	<StatTiles tiles={data.dashboard.tiles} />

	<!-- This month side by side (category split, pace), then the 6-month trend full width. -->
	<div class="grid gap-4 lg:grid-cols-2">
		<CategorySpending
			rows={data.dashboard.byCategory}
			slices={data.dashboard.slices}
			subtitle={thisMonthLabel}
		/>
		<PaceChart
			points={data.dashboard.pace}
			thisMonthLabel={monthName(data.dashboard.month)}
			lastMonthLabel={monthName(data.dashboard.month.subtract({ months: 1 }))}
		/>
		<div class="lg:col-span-2"><MonthlyChart months={data.dashboard.trend} /></div>
	</div>
</main>

<AddTransactionDialog
	bind:open={addOpen}
	bind:kind={addKind}
	categories={data.categories}
	today={data.today}
	action="/transactions?/create"
	{onCreated}
/>
