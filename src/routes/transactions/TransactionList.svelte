<!--
	@component
	Compact transaction rows for small screens:
	[icon] 01/31/2026  Name  $Amount  [⋯]
	The ⋯ button expands the row to show the full name, category and notes.
-->
<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatNumericDate } from '#lib/date-range.ts';
	import { formatCents } from '#lib/money.ts';
	import type { TransactionRow } from '#lib/server/budget/transactions.ts';

	let { rows }: { rows: TransactionRow[] } = $props();

	const expanded = new SvelteSet<string>();

	// Details slide open/closed; instant for people who turned on "reduce motion".
	let slideDuration = $derived(prefersReducedMotion.current ? 0 : 300);

	function toggle(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}
</script>

<ul
	class="divide-y divide-gray-100 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
>
	{#each rows as row (row.id)}
		{@const Icon = categoryIcon(row.categoryIcon)}
		{@const open = expanded.has(row.id)}
		<li>
			<div class="flex items-center gap-2 py-2 pr-1 pl-3 text-sm">
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
				<dl
					transition:slide={{ duration: slideDuration, easing: cubicOut }}
					id="details-{row.id}"
					class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-gray-50 px-3 py-2 text-xs dark:bg-gray-900"
				>
					<dt class="text-gray-500">Name</dt>
					<dd class="break-words">{row.name}</dd>
					<dt class="text-gray-500">Category</dt>
					<dd>{row.categoryName}</dd>
					<dt class="text-gray-500">Notes</dt>
					<dd class={row.notes ? '' : 'text-gray-400 italic'}>{row.notes ?? 'No notes'}</dd>
				</dl>
			{/if}
		</li>
	{/each}
</ul>
