<script lang="ts">
	import { Tabs } from 'bits-ui';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatRange } from '#lib/date-range.ts';
	import { formatCents } from '#lib/money.ts';
	import { updateQuery } from '#lib/url.ts';
	import type { TransactionRow } from '#lib/server/budget/transactions.ts';
	import RangePicker from './RangePicker.svelte';
	import TransactionList from './TransactionList.svelte';
	import TransactionTable from './TransactionTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sum = (rows: TransactionRow[]) => rows.reduce((total, row) => total + row.amountCents, 0);

	let rangeLabel = $derived(formatRange(data.range));
	let incomeTotal = $derived(sum(data.incomes));
	let expenseTotal = $derived(sum(data.expenses));

	// The open tab lives in the URL (?tab=income) so reloads and shared links keep it.
	// Expenses is the default and has no param.
	let tab = $derived(page.url.searchParams.get('tab') === 'income' ? 'income' : 'expenses');

	function selectTab(value: string) {
		const query = updateQuery(page.url.search, { tab: value === 'income' ? 'income' : null });
		// Shallow + replace: updates the URL without reloading data or adding a history entry.
		goto(resolve(`/transactions${query}`), { shallow: true, replace: true });
	}
</script>

<svelte:head>
	<title>Transactions · Budget</title>
</svelte:head>

{#snippet table(rows: TransactionRow[], kind: 'income' | 'expenses')}
	{#if rows.length === 0}
		<p
			class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
		>
			No {kind} from {rangeLabel}.
		</p>
	{:else}
		<!-- Both are rendered and CSS picks one, so there's no layout jump on load. -->
		<div class="sm:hidden"><TransactionList {rows} /></div>
		<div class="hidden sm:block"><TransactionTable {rows} /></div>
	{/if}
{/snippet}

<main class="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
	<header class="flex flex-col gap-4">
		<div class="flex items-baseline justify-between gap-4">
			<h1 class="text-2xl font-semibold">Transactions</h1>
			<a href={resolve('/')} class="text-sm text-gray-500 hover:underline">Home</a>
		</div>
		<RangePicker range={data.range} />
		{#if data.range.error}
			<p class="text-sm text-amber-700 dark:text-amber-400" role="alert">
				{data.range.error} Showing this month instead.
			</p>
		{/if}
		<dl class="grid grid-cols-3 gap-2 text-sm sm:max-w-md">
			<div>
				<dt class="text-gray-500">Income</dt>
				<dd class="font-medium tabular-nums">{formatCents(incomeTotal)}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Expenses</dt>
				<dd class="font-medium tabular-nums">{formatCents(expenseTotal)}</dd>
			</div>
			<div>
				<dt class="text-gray-500">Net</dt>
				<dd class="font-medium tabular-nums">{formatCents(incomeTotal - expenseTotal)}</dd>
			</div>
		</dl>
		<p class="text-xs text-gray-500">{rangeLabel}</p>
	</header>

	<Tabs.Root value={tab} onValueChange={selectTab} class="flex flex-col gap-3">
		<Tabs.List class="flex gap-1 border-b border-gray-200 dark:border-gray-800">
			{#each [{ value: 'expenses', label: 'Expenses', count: data.expenses.length }, { value: 'income', label: 'Income', count: data.incomes.length }] as item (item.value)}
				<Tabs.Trigger
					value={item.value}
					class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-gray-500 transition hover:text-gray-900 data-[state=active]:border-gray-900 data-[state=active]:font-medium data-[state=active]:text-gray-900 dark:hover:text-gray-100 dark:data-[state=active]:border-gray-100 dark:data-[state=active]:text-gray-100"
				>
					{item.label}
					<span class="ml-1 text-xs text-gray-400 tabular-nums">{item.count}</span>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
		<Tabs.Content value="expenses">{@render table(data.expenses, 'expenses')}</Tabs.Content>
		<Tabs.Content value="income">{@render table(data.incomes, 'income')}</Tabs.Content>
	</Tabs.Root>
</main>
