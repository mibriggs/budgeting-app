<!--
	@component
	This month's spending by category as ranked horizontal bars, largest first, one hue. Bars on a
	shared baseline compare more exactly than pie slices. Every value is printed at the bar's end.
-->
<script lang="ts">
	import { categoryIcon } from '#lib/category-icons.ts';
	import type { CategorySlice } from '#lib/dashboard.ts';
	import { formatCents } from '#lib/money.ts';

	let { rows }: { rows: CategorySlice[] } = $props();

	let max = $derived(rows.reduce((m, r) => Math.max(m, r.cents), 0));
</script>

<ul class="flex flex-col gap-2 text-sm" aria-label="Categories, largest first">
	{#each rows as row (row.name)}
		{@const Icon = categoryIcon(row.icon)}
		<li class="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
			<span class="flex min-w-0 items-center gap-1.5">
				<Icon class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
				<span class="truncate">{row.name}</span>
			</span>
			<!-- 10px bar (well under the 24px cap), rounded at the data end, square at the baseline. -->
			<span class="h-2.5" aria-hidden="true">
				<span
					class="block h-full rounded-r bg-(--chart-1)"
					style:width="{max > 0 ? Math.max((row.cents / max) * 100, 1) : 0}%"
				></span>
			</span>
			<span class="text-right tabular-nums">{formatCents(row.cents)}</span>
		</li>
	{/each}
</ul>
