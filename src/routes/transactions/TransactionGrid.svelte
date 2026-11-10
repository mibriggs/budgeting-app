<!--
	@component
	Drizzle Studio–style data grid for wider screens: dense rows, cell borders, a sticky
	header showing each column's name and type, row numbers, and sortable columns.
	Checkboxes select rows (Shift-click selects a range); the header box selects the whole tab.
	Only the rows in view are rendered (virtualized), so thousands of rows scroll smoothly.
	As tall as its rows, up to its parent's height; past that it scrolls inside itself.
-->
<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatDate } from '#lib/date-range.ts';
	import { formatCents } from '#lib/money.ts';
	import type { TransactionRow } from '#lib/server/budget/transactions.ts';
	import { createElementVirtualizer } from '#lib/virtualizer.svelte.ts';
	import type { SvelteSet } from 'svelte/reactivity';
	import { nextSort, sortRows, type Sort, type SortKey } from './sort.ts';

	let {
		rows,
		label,
		selected,
		active = true
	}: {
		rows: TransactionRow[];
		label: string;
		/** IDs of ticked rows. Shared with the page, which owns deleting them. */
		selected: SvelteSet<string>;
		/** False while hidden by CSS, so it doesn't render rows nobody can see. */
		active?: boolean;
	} = $props();

	const ROW_HEIGHT = 32;

	const columns: { key: SortKey; name: string; type: string; align?: 'right' }[] = [
		{ key: 'date', name: 'Date', type: 'date' },
		{ key: 'name', name: 'Name', type: 'text' },
		{ key: 'categoryName', name: 'Category', type: 'text' },
		{ key: 'amountCents', name: 'Amount', type: 'money', align: 'right' },
		{ key: 'notes', name: 'Notes', type: 'text' }
	];
	// Checkbox, row number, then the columns above. Shared by the header and every row.
	const template = '2.25rem 3.5rem 8.5rem minmax(14rem,1.5fr) 14rem 7.5rem minmax(15rem,2fr)';

	let sort = $state<Sort>(null);
	let sorted = $derived(sortRows(rows, sort));

	let scrollElement = $state<HTMLDivElement | null>(null);
	const virtualizer = createElementVirtualizer<HTMLDivElement>(() => ({
		count: sorted.length,
		getScrollElement: () => scrollElement,
		estimateSize: () => ROW_HEIGHT,
		getItemKey: (index) => sorted[index].id,
		overscan: 12,
		enabled: active,
		// Lets the server render the first screenful before the real size is known.
		initialRect: { width: 1200, height: 800 }
	}));

	// Selection. The header box ticks every row in this tab, not just the ones on screen.
	let selectedCount = $derived(rows.reduce((n, row) => n + (selected.has(row.id) ? 1 : 0), 0));
	let allSelected = $derived(rows.length > 0 && selectedCount === rows.length);

	function toggleAll() {
		if (allSelected) for (const row of rows) selected.delete(row.id);
		else for (const row of rows) selected.add(row.id);
	}

	// The last row clicked without Shift; Shift-click applies the same state to every row between.
	let anchorId: string | null = null;

	function toggleRow(event: MouseEvent, index: number) {
		const id = sorted[index].id;
		const select = !selected.has(id);
		const anchor = anchorId ? sorted.findIndex((row) => row.id === anchorId) : -1;

		if (event.shiftKey && anchor !== -1) {
			const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
			for (const row of sorted.slice(from, to + 1)) {
				if (select) selected.add(row.id);
				else selected.delete(row.id);
			}
		} else {
			if (select) selected.add(id);
			else selected.delete(id);
			anchorId = id;
		}
	}

	const checkbox =
		'size-4 cursor-pointer rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100';

	function ariaSort(key: SortKey) {
		if (sort?.key !== key) return 'none';
		return sort.direction === 'asc' ? 'ascending' : 'descending';
	}

	const cell = 'flex items-center truncate border-r border-gray-200 px-2 dark:border-gray-800';
</script>

<div
	bind:this={scrollElement}
	class="max-h-full overflow-auto rounded-md border border-gray-200 text-sm dark:border-gray-800"
	role="table"
	aria-label={label}
	aria-rowcount={sorted.length + 1}
>
	<div class="min-w-[64rem]">
		<!-- Header: sticks to the top while the body scrolls under it. -->
		<div
			role="row"
			aria-rowindex={1}
			class="sticky top-0 z-20 grid border-b border-gray-200 bg-gray-50 text-xs dark:border-gray-800 dark:bg-gray-900"
			style:grid-template-columns={template}
		>
			<div
				role="columnheader"
				class="sticky left-0 z-10 flex items-center justify-center border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
			>
				<input
					type="checkbox"
					class={checkbox}
					checked={allSelected}
					{@attach (node) => {
						node.indeterminate = selectedCount > 0 && !allSelected;
					}}
					onchange={toggleAll}
					disabled={rows.length === 0}
					aria-label={allSelected
						? `Deselect all ${label.toLowerCase()}`
						: `Select all ${label.toLowerCase()}`}
				/>
			</div>
			<div
				role="columnheader"
				class="sticky left-9 z-10 border-r border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
			>
				<span class="sr-only">Row</span>
			</div>
			{#each columns as column (column.key)}
				{@const active = sort?.key === column.key}
				<div
					role="columnheader"
					aria-sort={ariaSort(column.key)}
					class="border-r border-gray-200 last:border-r-0 dark:border-gray-800"
				>
					<button
						type="button"
						onclick={() => (sort = nextSort(sort, column.key))}
						class={[
							'group flex h-9 w-full items-center gap-1.5 px-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800',
							column.align === 'right' && 'flex-row-reverse text-right'
						]}
					>
						<span class="font-medium text-gray-900 dark:text-gray-100">{column.name}</span>
						<span class="font-mono text-[0.7rem] text-gray-400">{column.type}</span>
						<span class={['text-gray-400', column.align === 'right' ? 'mr-auto' : 'ml-auto']}>
							{#if active && sort?.direction === 'asc'}
								<ArrowUp class="size-3.5" aria-hidden="true" />
							{:else if active}
								<ArrowDown class="size-3.5" aria-hidden="true" />
							{:else}
								<ChevronsUpDown
									class="size-3.5 opacity-0 group-hover:opacity-100"
									aria-hidden="true"
								/>
							{/if}
						</span>
					</button>
				</div>
			{/each}
		</div>

		<!-- Body: a spacer as tall as every row, with only the visible rows placed inside. -->
		<div class="relative" style:height="{virtualizer.totalSize}px">
			{#each virtualizer.items as item (item.key)}
				{@const row = sorted[item.index]}
				{@const Icon = categoryIcon(row.categoryIcon)}
				{@const isSelected = selected.has(row.id)}
				<!-- Row background; the sticky cells repeat it so scrolled content doesn't show through. -->
				{@const background = isSelected
					? 'bg-blue-50 dark:bg-blue-950/60'
					: 'bg-white group-hover:bg-gray-50 dark:bg-gray-950 dark:group-hover:bg-gray-900'}
				<div
					role="row"
					aria-rowindex={item.index + 2}
					aria-selected={isSelected}
					class={[
						'group absolute inset-x-0 top-0 grid border-gray-100 dark:border-gray-800/60',
						// The box's own border closes off the last row.
						item.index < sorted.length - 1 && 'border-b',
						background
					]}
					style:grid-template-columns={template}
					style:height="{ROW_HEIGHT}px"
					style:transform="translateY({item.start}px)"
				>
					<div role="cell" class="{cell} sticky left-0 justify-center px-0 {background}">
						<input
							type="checkbox"
							class={checkbox}
							checked={isSelected}
							onclick={(event) => toggleRow(event, item.index)}
							aria-label="Select {row.name}, {formatDate(row.date)}, {formatCents(row.amountCents)}"
						/>
					</div>
					<div
						role="cell"
						class="{cell} sticky left-9 justify-end font-mono text-xs text-gray-400 tabular-nums {background}"
					>
						{item.index + 1}
					</div>
					<div role="cell" class="{cell} tabular-nums">{formatDate(row.date)}</div>
					<div role="cell" class={cell} title={row.name}>
						<span class="truncate">{row.name}</span>
					</div>
					<div role="cell" class="{cell} gap-2">
						<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
						<span class="truncate">{row.categoryName}</span>
					</div>
					<div role="cell" class="{cell} justify-end tabular-nums">
						{formatCents(row.amountCents)}
					</div>
					<div role="cell" class="{cell} border-r-0" title={row.notes ?? undefined}>
						{#if row.notes}
							<span class="truncate text-gray-600 dark:text-gray-400">{row.notes}</span>
						{:else}
							<span class="font-mono text-xs text-gray-300 italic dark:text-gray-600">NULL</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
