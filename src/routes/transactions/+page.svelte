<script lang="ts">
	import ListFilter from '@lucide/svelte/icons/list-filter';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import Trash from '@lucide/svelte/icons/trash';
	import { Tabs } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import { Temporal } from '#lib/dates.ts';
	import { formatDate, formatRange, monthRangeParams } from '#lib/date-range.ts';
	import { createMediaQuery, WIDE_SCREEN } from '#lib/media.svelte.ts';
	import { formatCents } from '#lib/money.ts';
	import { shownUrl, updateQuery } from '#lib/url.ts';
	import type { TransactionKind, TransactionRow } from '#lib/server/budget/transactions.ts';
	import AddTransactionDialog, { type Saved } from '#lib/components/AddTransactionDialog.svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import DeleteDialog from './DeleteDialog.svelte';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import TransactionList from './TransactionList.svelte';
	import TransactionGrid from './TransactionGrid.svelte';
	import FilterOptionIcon from './FilterOptionIcon.svelte';
	import FilterPopover from './FilterPopover.svelte';
	import FilterSheet from './FilterSheet.svelte';
	import {
		FILTER_BUTTON,
		NO_FILTERS,
		filterOptions,
		filterParams,
		isFiltering,
		matches,
		readFilters,
		type ExpenseFilters,
		type FilterKind
	} from './filters.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Which layout is visible; the other one stops rendering rows once this is known.
	const wide = createMediaQuery(WIDE_SCREEN);

	const sum = (rows: TransactionRow[]) => rows.reduce((total, row) => total + row.amountCents, 0);

	let rangeLabel = $derived(formatRange(data.range));

	// Expense filters (category, payment method), kept in the URL like the tab. They filter the
	// rows already loaded; see filters.ts.
	let filterView = $derived(
		filterOptions(data.expenses, readFilters(shownUrl(page).searchParams), {
			categories: data.categories.expense,
			paymentMethods: data.paymentMethods
		})
	);
	let filters = $derived(filterView.filters);
	let filtering = $derived(isFiltering(filters));
	let filterCount = $derived(filters.categories.size + filters.methods.size);
	let expenses = $derived(
		filtering ? data.expenses.filter((row) => matches(filters, row)) : data.expenses
	);
	let filterSheetOpen = $state(false);

	function setFilters(next: ExpenseFilters) {
		const query = updateQuery(shownUrl(page).search, filterParams(next));
		goto(resolve(`/transactions${query}`), { shallow: true, replace: true });
	}
	function toggleFilter(kind: FilterKind, id: string) {
		// A plain Set: it's a new value for the URL, not state.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const ticked = new Set(filters[kind]);
		if (ticked.has(id)) ticked.delete(id);
		else ticked.add(id);
		setFilters({ ...filters, [kind]: ticked });
	}
	const clearFilter = (kind: FilterKind) => setFilters({ ...filters, [kind]: new Set() });
	const clearFilters = () => setFilters({ categories: new Set(), methods: new Set() });

	// Phones: what's ticked, as chips that untick one value each.
	let chips = $derived(
		(['categories', 'methods'] as const).flatMap((kind) =>
			filterView[kind]
				.filter((option) => filters[kind].has(option.id))
				.map((option) => ({ kind, option }))
		)
	);

	/** True when the filters would hide this new or edited expense. */
	const hiddenByFilters = ({ kind, categoryId, paymentMethodId }: Saved) =>
		kind === 'expense' && !matches(filters, { categoryId, paymentMethodId });

	// Totals follow the filters: Expenses and Net count only the expenses shown.
	let incomeTotal = $derived(sum(data.incomes));
	let expenseTotal = $derived(sum(expenses));

	// The open tab lives in the URL (?tab=income) so reloads and shared links keep it.
	// Expenses is the default and has no param.
	let tab = $derived(shownUrl(page).searchParams.get('tab') === 'income' ? 'income' : 'expenses');

	// Ticked rows, kept separately for each tab.
	const selections: Record<TransactionKind, SvelteSet<string>> = {
		expense: new SvelteSet(),
		income: new SvelteSet()
	};
	// Phones only: whether rows show checkboxes.
	let selecting = $state(false);

	// Drop selected IDs that are no longer loaded (deleted, or outside a new date range).
	$effect(() => {
		// Only rows the filters show can stay selected.
		prune(selections.expense, expenses);
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
		toast.success(`Deleted ${count} ${count === 1 ? one : many}.`);
	}

	// Adding: one dialog, for whichever type's button was pressed (no switch here).
	let addKind = $state<TransactionKind>('expense');
	let addOpen = $state(false);

	function openAdd(kind: TransactionKind) {
		addKind = kind;
		addOpen = true;
	}

	function onCreated(created: Saved) {
		const { kind, name, date } = created;
		const inRange =
			Temporal.PlainDate.compare(date, data.range.from) >= 0 &&
			Temporal.PlainDate.compare(date, data.range.to) <= 0;
		const otherTab = (kind === 'income') !== (tab === 'income');
		const hidden = hiddenByFilters(created);
		if (inRange && !otherTab && !hidden) {
			toast.success(`Added “${name}”.`);
			return;
		}
		if (inRange && !otherTab) {
			toast.success(`Added “${name}”.`, {
				description: 'Your filters hide it.',
				action: { label: 'Clear filters', onClick: clearFilters }
			});
			return;
		}
		// Otherwise the new row isn't in view, so say where it went and offer to go there.
		toast.success(`Added “${name}”.`, {
			description: inRange
				? `It’s on the ${kind === 'income' ? 'Income' : 'Expenses'} tab.`
				: `${formatDate(date)} is outside the dates you’re viewing.`,
			action: {
				label: 'Show',
				onClick: () =>
					goto(
						resolve(
							`/transactions${updateQuery(shownUrl(page).search, {
								// Keep the current dates when the entry is already in them.
								...(inRange ? {} : monthRangeParams(date, data.today)),
								...(hidden ? NO_FILTERS : {}),
								tab: kind === 'income' ? 'income' : null
							})}`
						)
					)
			}
		});
	}

	// Editing: the same dialog in edit mode, opened from a row (phone ⋯ details, double-click or
	// Enter in the table) or the Edit button when exactly one row is ticked.
	let editRow = $state<TransactionRow | null>(null);
	let editKind = $state<TransactionKind>('expense');
	let editOpen = $state(false);
	function openEdit(kind: TransactionKind, row: TransactionRow | undefined) {
		if (!row) return;
		editKind = kind;
		editRow = row;
		editOpen = true;
	}

	function onSaved(saved: Saved) {
		const { date } = saved;
		const inRange =
			Temporal.PlainDate.compare(date, data.range.from) >= 0 &&
			Temporal.PlainDate.compare(date, data.range.to) <= 0;
		const hidden = hiddenByFilters(saved);
		if (inRange && !hidden) {
			toast.success('Saved changes.');
			return;
		}
		if (inRange) {
			toast.success('Saved changes.', {
				description: 'Your filters hide it now.',
				action: { label: 'Clear filters', onClick: clearFilters }
			});
			return;
		}
		// The new date moved it out of view: say so and offer to go there.
		toast.success('Saved changes.', {
			description: `${formatDate(date)} is outside the dates you’re viewing.`,
			action: {
				label: 'Show',
				onClick: () =>
					goto(
						resolve(
							`/transactions${updateQuery(shownUrl(page).search, {
								...monthRangeParams(date, data.today),
								...(hidden ? NO_FILTERS : {})
							})}`
						)
					)
			}
		});
	}

	function onEditDeleted({ kind, name }: { kind: TransactionKind; name: string }) {
		if (editRow) selections[kind].delete(editRow.id);
		toast.success(`Deleted “${name}”.`);
	}

	function selectTab(value: string) {
		const query = updateQuery(shownUrl(page).search, { tab: value === 'income' ? 'income' : null });
		// Shallow + replace: updates the URL without reloading data or adding a history entry.
		goto(resolve(`/transactions${query}`), { shallow: true, replace: true });
	}
</script>

<svelte:head>
	<title>Transactions · CentJar</title>
</svelte:head>

{#snippet addButton(kind: TransactionKind)}
	<button
		type="button"
		class="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:bg-gray-700 dark:border-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
		onclick={() => openAdd(kind)}
	>
		<Plus class="size-4" aria-hidden="true" />
		<!-- Just "Add" on the narrowest phones, so the toolbar stays on one line. -->
		<span
			>Add <span class="max-[22.5rem]:sr-only">{kind === 'expense' ? 'expense' : 'income'}</span
			></span
		>
	</button>
{/snippet}

<!-- `rows` are the rows shown (after filters); `loaded` is how many the dates have in all. -->
{#snippet table(rows: TransactionRow[], kind: TransactionKind, loaded: number)}
	{@const label = kind === 'income' ? 'Income' : 'Expenses'}
	{@const selected = selections[kind]}
	{@const filterable = kind === 'expense'}
	{#if loaded === 0}
		<div
			class="flex flex-col items-center gap-3 rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
		>
			<p>No {label.toLowerCase()} from {rangeLabel}.</p>
			{@render addButton(kind)}
		</div>
	{:else}
		<div class="flex h-full flex-col gap-2">
			<!-- Toolbar: selection and (expenses) filters. Sticks just below the header on phones,
			     where the page itself scrolls. -->
			<div
				class="sticky top-14 z-30 -mx-4 flex flex-col gap-1 bg-white px-4 py-1 sm:static sm:mx-0 sm:px-0 dark:bg-gray-950"
			>
				<div class="flex min-h-10 flex-wrap items-center gap-2 text-sm">
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
					{#if filterable && !selecting}
						<!-- Phones: one Filters button opening a sheet with both filters. -->
						<button
							type="button"
							class="{FILTER_BUTTON} sm:hidden"
							data-active={filtering || undefined}
							onclick={() => (filterSheetOpen = true)}
						>
							<ListFilter class="size-4" aria-hidden="true" />
							<!-- When filters are on, narrow phones show just the icon and count; the chips
						     below already say what's filtered. -->
							<span class={filtering ? 'max-[24rem]:sr-only' : ''}>Filters</span>
							{#if filtering}
								<span
									class="min-w-5 rounded-full bg-white px-1.5 text-center text-xs leading-5 font-semibold text-gray-900 tabular-nums dark:bg-gray-900 dark:text-white"
									>{filterCount}<span class="sr-only"> on</span></span
								>
							{/if}
						</button>
					{/if}
					{#if selecting && selected.size < rows.length}
						<button
							type="button"
							class="rounded-md px-2 py-1.5 text-gray-600 sm:hidden dark:text-gray-400"
							onclick={() => rows.forEach((row) => selected.add(row.id))}
						>
							Select all
						</button>
					{/if}

					{#if filterable}
						<!-- Wider screens: a dropdown per filter. -->
						<div class="hidden items-center gap-2 sm:flex">
							<FilterPopover
								name="Category"
								options={filterView.categories}
								ticked={filters.categories}
								onToggle={(id) => toggleFilter('categories', id)}
								onClear={() => clearFilter('categories')}
							/>
							<FilterPopover
								name="Paid with"
								options={filterView.methods}
								ticked={filters.methods}
								onToggle={(id) => toggleFilter('methods', id)}
								onClear={() => clearFilter('methods')}
							/>
							{#if filtering}
								<button
									type="button"
									class="flex items-center gap-1 rounded-md px-2 py-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
									onclick={clearFilters}
								>
									<X class="size-3.5" aria-hidden="true" />
									Clear filters
								</button>
							{/if}
						</div>
					{/if}

					<p class="text-gray-500" aria-live="polite">
						{#if selected.size > 0}
							<span class="font-medium text-gray-900 dark:text-gray-100">{selected.size}</span> selected
						{:else if !(filterable && filtering)}
							<!-- Next to the filters there's room for it only on large screens. -->
							<span class={filterable ? 'hidden lg:inline' : 'hidden sm:inline'}
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
							{#if selected.size === 1}
								<!-- Larger screens; phones edit from the row's ⋯ details. -->
								<button
									type="button"
									class="hidden items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-100 sm:flex dark:border-gray-700 dark:hover:bg-gray-800"
									onclick={() =>
										openEdit(
											kind,
											rows.find((row) => selected.has(row.id))
										)}
								>
									<Pencil class="size-4" aria-hidden="true" />
									Edit
								</button>
							{/if}
							<button
								type="button"
								class="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
								onclick={() => confirmDelete(kind, [...selected])}
							>
								<Trash class="size-4" aria-hidden="true" />
								Delete
							</button>
						</div>
					{:else if !selecting}
						<div class="ml-auto">{@render addButton(kind)}</div>
					{/if}
				</div>

				{#if filterable && filtering && !selecting}
					<!-- Phones: what's ticked, as chips that each untick one value. -->
					<div class="-mx-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 sm:hidden">
						{#each chips as chip (chip.kind + chip.option.id)}
							<button
								type="button"
								class="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 py-1 pr-2 pl-2.5 text-xs dark:bg-gray-800"
								onclick={() => toggleFilter(chip.kind, chip.option.id)}
								aria-label="Remove filter: {chip.option.label}"
							>
								<FilterOptionIcon icon={chip.option.icon} class="size-3.5" />
								{chip.option.label}
								<X class="size-3.5 text-gray-500" aria-hidden="true" />
							</button>
						{/each}
						<button
							type="button"
							class="shrink-0 px-2 py-1 text-xs text-gray-600 dark:text-gray-400"
							onclick={clearFilters}>Clear all</button
						>
					</div>
				{/if}
			</div>

			{#if rows.length === 0}
				<div
					class="flex flex-col items-center gap-3 rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
				>
					<p>No {label.toLowerCase()} match these filters.</p>
					<button
						type="button"
						class="rounded-md border border-gray-300 px-3 py-1.5 text-gray-900 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
						onclick={clearFilters}>Clear filters</button
					>
				</div>
			{:else}
				<!-- Both are rendered and CSS picks one, so there's no layout jump on load.
			     Each is virtualized, so the hidden one only renders a handful of rows. -->
				<div class="sm:hidden">
					<TransactionList
						{rows}
						{selected}
						{selecting}
						onDelete={(ids) => confirmDelete(kind, ids)}
						onEdit={(row) => openEdit(kind, row)}
						paidWith={kind === 'expense'}
						active={wide.current !== true}
					/>
				</div>
				<div class="hidden min-h-0 flex-1 sm:block">
					<TransactionGrid
						{rows}
						{label}
						{selected}
						onEdit={(row) => openEdit(kind, row)}
						paidWith={kind === 'expense'}
						active={wide.current !== false}
					/>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

<!-- On wider screens the page is exactly one screen tall and the grid scrolls inside it. -->
<div class="flex flex-col sm:h-dvh">
	<AppHeader name={data.displayName} />
	<main
		class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-2 pb-4 sm:px-6 sm:pb-6"
	>
		<header class="flex flex-col gap-4">
			<h1 class="text-2xl font-semibold">Transactions</h1>
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
					<dt class="flex items-center gap-1 text-gray-500">
						Expenses
						{#if filtering}<ListFilter class="size-3.5" aria-label="filtered" />{/if}
					</dt>
					<dd class="font-medium tabular-nums">{formatCents(expenseTotal)}</dd>
				</div>
				<div>
					<dt class="flex items-center gap-1 text-gray-500">
						Net
						{#if filtering}<ListFilter class="size-3.5" aria-label="filtered" />{/if}
					</dt>
					<dd class="font-medium tabular-nums">{formatCents(incomeTotal - expenseTotal)}</dd>
				</div>
			</dl>
			<p class="text-xs text-gray-500">
				{rangeLabel}
				{#if filtering}· Expenses and Net count only the filtered expenses{/if}
			</p>
		</header>

		<Tabs.Root value={tab} onValueChange={selectTab} class="flex min-h-0 flex-1 flex-col gap-3">
			<Tabs.List class="flex gap-1 border-b border-gray-200 dark:border-gray-800">
				{#each [{ value: 'expenses', label: 'Expenses', count: filtering ? `${expenses.length} of ${data.expenses.length}` : data.expenses.length }, { value: 'income', label: 'Income', count: data.incomes.length }] as item (item.value)}
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
				{@render table(expenses, 'expense', data.expenses.length)}
			</Tabs.Content>
			<Tabs.Content value="income" class="min-h-0 flex-1">
				{@render table(data.incomes, 'income', data.incomes.length)}
			</Tabs.Content>
		</Tabs.Root>
	</main>
</div>

<AddTransactionDialog
	bind:open={addOpen}
	bind:kind={addKind}
	categories={data.categories}
	paymentMethods={data.paymentMethods}
	today={data.today}
	{onCreated}
/>

<AddTransactionDialog
	bind:open={editOpen}
	bind:kind={editKind}
	editing={editRow}
	categories={data.categories}
	paymentMethods={data.paymentMethods}
	today={data.today}
	onCreated={() => {}}
	{onSaved}
	onDeleted={onEditDeleted}
/>

<FilterSheet
	bind:open={filterSheetOpen}
	options={{ categories: filterView.categories, methods: filterView.methods }}
	{filters}
	resultCount={expenses.length}
	onToggle={toggleFilter}
	onClear={clearFilters}
/>

{#if pendingDelete}
	<DeleteDialog
		bind:open={dialogOpen}
		kind={pendingDelete.kind}
		ids={pendingDelete.ids}
		{onDeleted}
	/>
{/if}
