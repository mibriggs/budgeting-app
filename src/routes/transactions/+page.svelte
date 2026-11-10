<script lang="ts">
	import Trash from '@lucide/svelte/icons/trash';
	import { Tabs } from 'bits-ui';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { formatRange } from '#lib/date-range.ts';
	import { createMediaQuery, WIDE_SCREEN } from '#lib/media.svelte.ts';
	import { formatCents } from '#lib/money.ts';
	import { updateQuery } from '#lib/url.ts';
	import type { TransactionKind, TransactionRow } from '#lib/server/budget/transactions.ts';
	import DeleteDialog from './DeleteDialog.svelte';
	import RangePicker from './RangePicker.svelte';
	import TransactionList from './TransactionList.svelte';
	import TransactionGrid from './TransactionGrid.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Which layout is visible; the other one stops rendering rows once this is known.
	const wide = createMediaQuery(WIDE_SCREEN);

	const sum = (rows: TransactionRow[]) => rows.reduce((total, row) => total + row.amountCents, 0);

	let rangeLabel = $derived(formatRange(data.range));
	let incomeTotal = $derived(sum(data.incomes));
	let expenseTotal = $derived(sum(data.expenses));

	// The open tab lives in the URL (?tab=income) so reloads and shared links keep it.
	// Expenses is the default and has no param.
	let tab = $derived(page.url.searchParams.get('tab') === 'income' ? 'income' : 'expenses');

	// Ticked rows, kept separately for each tab.
	const selections: Record<TransactionKind, SvelteSet<string>> = {
		expense: new SvelteSet(),
		income: new SvelteSet()
	};
	// Phones only: whether rows show checkboxes.
	let selecting = $state(false);

	// Drop selected IDs that are no longer loaded (deleted, or outside a new date range).
	$effect(() => {
		prune(selections.expense, data.expenses);
		prune(selections.income, data.incomes);
	});
	function prune(selected: SvelteSet<string>, rows: TransactionRow[]) {
		const loaded = new Set(rows.map((row) => row.id));
		untrack(() => {
			for (const id of [...selected]) if (!loaded.has(id)) selected.delete(id);
		});
	}

	// Deleting: the dialog confirms first, so nothing is removed by a single click.
	let pendingDelete = $state<{ kind: TransactionKind; ids: string[] } | null>(null);
	let dialogOpen = $state(false);
	let status = $state('');
	let statusTimer: ReturnType<typeof setTimeout> | undefined;

	function confirmDelete(kind: TransactionKind, ids: string[]) {
		if (ids.length === 0) return;
		pendingDelete = { kind, ids };
		dialogOpen = true;
	}

	function onDeleted(count: number) {
		if (!pendingDelete) return;
		const { kind } = pendingDelete;
		for (const id of pendingDelete.ids) selections[kind].delete(id);
		if (selections[kind].size === 0) selecting = false;

		const [one, many] =
			kind === 'expense' ? ['expense', 'expenses'] : ['income entry', 'income entries'];
		status = `Deleted ${count} ${count === 1 ? one : many}.`;
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => (status = ''), 5000);
	}

	function selectTab(value: string) {
		const query = updateQuery(page.url.search, { tab: value === 'income' ? 'income' : null });
		// Shallow + replace: updates the URL without reloading data or adding a history entry.
		goto(resolve(`/transactions${query}`), { shallow: true, replace: true });
	}
</script>

<svelte:head>
	<title>Transactions · Budget</title>
</svelte:head>

{#snippet table(rows: TransactionRow[], kind: TransactionKind)}
	{@const label = kind === 'income' ? 'Income' : 'Expenses'}
	{@const selected = selections[kind]}
	{#if rows.length === 0}
		<p
			class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
		>
			No {label.toLowerCase()} from {rangeLabel}.
		</p>
		{#if status}<p class="mt-2 text-sm text-gray-500" role="status">{status}</p>{/if}
	{:else}
		<div class="flex h-full flex-col gap-2">
			<!-- Selection bar. Sticks to the top on phones, where the page itself scrolls. -->
			<div
				class="sticky top-0 z-30 -mx-4 flex min-h-10 flex-wrap items-center gap-2 bg-white px-4 py-1 text-sm sm:static sm:mx-0 sm:px-0 dark:bg-gray-950"
			>
				<button
					type="button"
					class="rounded-md border border-gray-300 px-3 py-1.5 sm:hidden dark:border-gray-700"
					onclick={() => {
						selecting = !selecting;
						if (!selecting) selected.clear();
					}}
				>
					{selecting ? 'Done' : 'Select'}
				</button>
				{#if selecting && selected.size < rows.length}
					<button
						type="button"
						class="rounded-md px-2 py-1.5 text-gray-600 sm:hidden dark:text-gray-400"
						onclick={() => rows.forEach((row) => selected.add(row.id))}
					>
						Select all
					</button>
				{/if}

				<p class="text-gray-500" aria-live="polite">
					{#if selected.size > 0}
						<span class="font-medium text-gray-900 dark:text-gray-100">{selected.size}</span> selected
					{:else if status}
						{status}
					{:else}
						<span class="hidden sm:inline"
							>Tick rows to select them. Shift-click selects a range.</span
						>
					{/if}
				</p>

				{#if selected.size > 0}
					<div class="ml-auto flex gap-2">
						<button
							type="button"
							class="rounded-md px-3 py-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
							onclick={() => selected.clear()}
						>
							Clear
						</button>
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
							onclick={() => confirmDelete(kind, [...selected])}
						>
							<Trash class="size-4" aria-hidden="true" />
							Delete
						</button>
					</div>
				{/if}
			</div>

			<!-- Both are rendered and CSS picks one, so there's no layout jump on load.
			     Each is virtualized, so the hidden one only renders a handful of rows. -->
			<div class="sm:hidden">
				<TransactionList
					{rows}
					{selected}
					{selecting}
					onDelete={(ids) => confirmDelete(kind, ids)}
					active={wide.current !== true}
				/>
			</div>
			<div class="hidden min-h-0 flex-1 sm:block">
				<TransactionGrid {rows} {label} {selected} active={wide.current !== false} />
			</div>
		</div>
	{/if}
{/snippet}

<!-- On wider screens the page is exactly one screen tall and the grid scrolls inside it. -->
<main class="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:h-dvh sm:p-6">
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

	<Tabs.Root value={tab} onValueChange={selectTab} class="flex min-h-0 flex-1 flex-col gap-3">
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
		<Tabs.Content value="expenses" class="min-h-0 flex-1">
			{@render table(data.expenses, 'expense')}
		</Tabs.Content>
		<Tabs.Content value="income" class="min-h-0 flex-1">
			{@render table(data.incomes, 'income')}
		</Tabs.Content>
	</Tabs.Root>
</main>

{#if pendingDelete}
	<DeleteDialog
		bind:open={dialogOpen}
		kind={pendingDelete.kind}
		ids={pendingDelete.ids}
		{onDeleted}
	/>
{/if}
