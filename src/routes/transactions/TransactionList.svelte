<!--
	@component
	Compact transaction rows for small screens:
	[icon] 01/31/2026  Name  $Amount  [⋯]
	The ⋯ button expands the row to show the full name, category and notes.
	Virtualized against the page scroll: only rows near the screen are rendered, and each
	row is measured so expanded rows push the ones below down.
-->
<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Trash from '@lucide/svelte/icons/trash';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatNumericDate } from '#lib/date-range.ts';
	import { formatCents } from '#lib/money.ts';
	import type { TransactionRow } from '#lib/server/budget/transactions.ts';
	import { createWindowVirtualizer } from '#lib/virtualizer.svelte.ts';

	let {
		rows,
		selected,
		selecting = false,
		onDelete,
		active = true
	}: {
		rows: TransactionRow[];
		/** IDs of ticked rows. Shared with the page, which owns deleting them. */
		selected: SvelteSet<string>;
		/** Show a checkbox on every row. */
		selecting?: boolean;
		/** Asks the page to confirm and delete these rows (the details' Delete button). */
		onDelete: (ids: string[]) => void;
		/** False while hidden by CSS: hidden rows measure 0px tall, so all of them would render. */
		active?: boolean;
	} = $props();

	function toggleSelected(id: string) {
		if (selected.has(id)) selected.delete(id);
		else selected.add(id);
	}

	const expanded = new SvelteSet<string>();

	// Details slide open/closed; instant for people who turned on "reduce motion".
	let slideDuration = $derived(prefersReducedMotion.current ? 0 : 300);

	function toggle(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	// Rows scroll with the page, so the virtualizer needs to know where the list starts.
	let list = $state<HTMLUListElement | null>(null);
	let scrollMargin = $state(0);
	$effect(() => {
		if (!list) return;
		const element = list;
		const update = () => (scrollMargin = element.getBoundingClientRect().top + window.scrollY);
		update();
		// Content above the list (totals, error messages) can change height.
		const observer = new ResizeObserver(update);
		observer.observe(document.body);
		return () => observer.disconnect();
	});

	const virtualizer = createWindowVirtualizer<HTMLLIElement>(() => ({
		count: rows.length,
		estimateSize: () => 49,
		getItemKey: (index) => rows[index].id,
		scrollMargin,
		overscan: 8,
		enabled: active,
		// Lets the server render the first screenful before the real size is known.
		initialRect: { width: 375, height: 800 }
	}));
</script>

<!-- A spacer as tall as every row; only rows near the screen are rendered inside it. -->
<ul
	bind:this={list}
	class="relative overflow-hidden rounded-md border border-gray-200 dark:border-gray-800"
	style:height="{virtualizer.totalSize}px"
>
	{#each virtualizer.items as item (item.key)}
		{@const row = rows[item.index]}
		{@const Icon = categoryIcon(row.categoryIcon)}
		{@const open = expanded.has(row.id)}
		<li
			data-index={item.index}
			{@attach virtualizer.measure}
			class={[
				'absolute inset-x-0 top-0 border-gray-100 dark:border-gray-800',
				item.index < rows.length - 1 && 'border-b'
			]}
			style:transform="translateY({item.start - scrollMargin}px)"
		>
			<div
				class={[
					'flex items-center gap-2 py-2 pr-1 pl-3 text-sm',
					selected.has(row.id) && 'bg-blue-50 dark:bg-blue-950/60'
				]}
			>
				{#if selecting}
					<input
						type="checkbox"
						class="size-5 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
						checked={selected.has(row.id)}
						onchange={() => toggleSelected(row.id)}
						aria-label="Select {row.name}, {formatNumericDate(row.date)}, {formatCents(
							row.amountCents
						)}"
					/>
				{/if}
				<Icon class="size-4 shrink-0 text-gray-500" aria-label={row.categoryName} />
				<span class="shrink-0 text-xs text-gray-500 tabular-nums"
					>{formatNumericDate(row.date)}</span
				>
				<span class="min-w-0 flex-1 truncate">{row.name}</span>
				<span class="shrink-0 font-medium tabular-nums">{formatCents(row.amountCents)}</span>
				<button
					type="button"
					class="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 aria-expanded:bg-gray-100 dark:hover:bg-gray-800 dark:aria-expanded:bg-gray-800"
					aria-expanded={open}
					aria-controls="details-{row.id}"
					aria-label="{open ? 'Hide' : 'Show'} details for {row.name}"
					onclick={() => toggle(row.id)}
				>
					<Ellipsis class="size-4" aria-hidden="true" />
				</button>
			</div>
			{#if open}
				<div
					transition:slide={{ duration: slideDuration, easing: cubicOut }}
					id="details-{row.id}"
					class="bg-gray-50 dark:bg-gray-900"
				>
					<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 pt-2 text-xs">
						<dt class="text-gray-500">Name</dt>
						<dd class="break-words">{row.name}</dd>
						<dt class="text-gray-500">Category</dt>
						<dd>{row.categoryName}</dd>
						<dt class="text-gray-500">Notes</dt>
						<dd class={row.notes ? '' : 'text-gray-400 italic'}>{row.notes ?? 'No notes'}</dd>
					</dl>
					<div class="flex justify-end px-1 pb-1">
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
							onclick={() => onDelete([row.id])}
						>
							<Trash class="size-3.5" aria-hidden="true" />
							Delete
						</button>
					</div>
				</div>
			{/if}
		</li>
	{/each}
</ul>
