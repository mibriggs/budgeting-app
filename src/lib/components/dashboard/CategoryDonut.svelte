<!--
	@component
	This month's spending by category as a donut: the top 6 categories plus "Other", with the
	month's total in the middle and a legend giving every slice's name, amount and share.
-->
<script lang="ts">
	import { PieChart } from 'layerchart';
	import type { CategorySlice } from '#lib/dashboard.ts';
	import { formatCents, formatCentsWhole, formatDollars } from '#lib/money.ts';

	let { slices }: { slices: CategorySlice[] } = $props();

	let total = $derived(slices.reduce((sum, s) => sum + s.cents, 0));
	// Colour follows the slot in fixed order; "Other" is always the neutral gray.
	let data = $derived(
		slices.map((s, i) => ({
			name: s.name,
			dollars: s.cents / 100,
			cents: s.cents,
			color:
				s.name === 'Other' && i === slices.length - 1
					? 'var(--chart-other)'
					: `var(--chart-${i + 1})`
		}))
	);

	const percent = (cents: number) => (total > 0 ? Math.round((cents / total) * 100) : 0);
</script>

<div class="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-center">
	<div class="relative size-44 shrink-0">
		<PieChart
			{data}
			key="name"
			value="dollars"
			c="color"
			innerRadius={0.62}
			padAngle={0.02}
			cornerRadius={3}
			props={{ tooltip: { item: { format: formatDollars } } }}
		/>
		<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
			<span class="text-xs text-gray-500 dark:text-gray-400">Total</span>
			<span class="text-base font-semibold tabular-nums">{formatCentsWhole(total)}</span>
		</div>
	</div>
	<ul class="flex w-full min-w-0 flex-col gap-1.5 text-sm" aria-label="Categories">
		{#each data as slice (slice.name)}
			<li class="flex items-center gap-2">
				<span
					class="size-2.5 shrink-0 rounded-full"
					style:background-color={slice.color}
					aria-hidden="true"
				></span>
				<span class="min-w-0 flex-1 truncate">{slice.name}</span>
				<span class="tabular-nums">{formatCents(slice.cents)}</span>
				<span class="w-9 text-right text-xs text-gray-500 tabular-nums dark:text-gray-400">
					{percent(slice.cents)}%
				</span>
			</li>
		{/each}
	</ul>
</div>
