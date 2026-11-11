<!--
	@component
	"This month at a glance": income, spent, net, and spending compared with last month at the
	same point in the month. Figures are rounded to whole dollars.
-->
<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import { formatCentsWhole } from '#lib/money.ts';

	let {
		tiles
	}: {
		tiles: {
			income: number;
			expenses: number;
			net: number;
			lastMonthToDate: number;
			dayOfMonth: number;
		};
	} = $props();

	// Change in spending vs. last month by the same day; null when last month had none.
	let change = $derived(
		tiles.lastMonthToDate > 0
			? Math.round(((tiles.expenses - tiles.lastMonthToDate) / tiles.lastMonthToDate) * 100)
			: null
	);

	// Net as "+$469" / "−$1,000" (a real minus sign), rounded like the other tiles.
	let netDirection = $derived<'up' | 'down' | 'flat'>(
		Math.round(tiles.net / 100) > 0 ? 'up' : Math.round(tiles.net / 100) < 0 ? 'down' : 'flat'
	);
	let signedNet = $derived(
		`${netDirection === 'up' ? '+' : netDirection === 'down' ? '−' : ''}${formatCentsWhole(Math.abs(tiles.net))}`
	);
</script>

<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
	<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
		<dt class="text-xs text-gray-500 dark:text-gray-400">Income</dt>
		<dd class="mt-1 text-xl font-semibold tabular-nums">{formatCentsWhole(tiles.income)}</dd>
	</div>
	<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
		<dt class="text-xs text-gray-500 dark:text-gray-400">Spent</dt>
		<dd class="mt-1 text-xl font-semibold tabular-nums">{formatCentsWhole(tiles.expenses)}</dd>
	</div>
	<!-- Net: tinted green when income beats spending, red when it doesn't. The arrow badge, the
	     sign and the word carry the meaning too, so it never relies on colour alone. -->
	<div
		class={[
			'rounded-lg border p-3',
			netDirection === 'up' &&
				'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40',
			netDirection === 'down' && 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40',
			netDirection === 'flat' && 'border-gray-200 dark:border-gray-800'
		]}
	>
		<dt class="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
			Net
			{#if netDirection !== 'flat'}
				<span
					class="flex size-6 items-center justify-center rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900"
					aria-hidden="true"
				>
					{#if netDirection === 'up'}
						<ArrowUp class="size-3.5" />
					{:else}
						<ArrowDown class="size-3.5" />
					{/if}
				</span>
			{/if}
		</dt>
		<dd class="mt-1 text-xl font-semibold tabular-nums">{signedNet}</dd>
		<dd class="text-xs text-gray-600 dark:text-gray-300">
			{netDirection === 'up' ? 'saved' : netDirection === 'down' ? 'overspent' : 'break-even'}
		</dd>
	</div>
	<div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
		<dt class="text-xs text-gray-500 dark:text-gray-400">
			Spent vs. last month <span class="whitespace-nowrap">(by day {tiles.dayOfMonth})</span>
		</dt>
		<dd class="mt-1 flex items-center gap-1 text-xl font-semibold tabular-nums">
			{#if change === null}
				<span class="text-gray-400">—</span>
			{:else}
				<!-- Spending more is the bad direction: shown with an arrow and words, not colour alone. -->
				<span
					class={change > 0
						? 'text-red-700 dark:text-red-400'
						: change < 0
							? 'text-green-700 dark:text-green-400'
							: ''}
				>
					{#if change > 0}<ArrowUp
							class="inline size-4"
							aria-hidden="true"
						/>{:else if change < 0}<ArrowDown
							class="inline size-4"
							aria-hidden="true"
						/>{/if}{Math.abs(change)}%
				</span>
				<span class="text-xs font-normal text-gray-500 dark:text-gray-400">
					{change > 0 ? 'more' : change < 0 ? 'less' : 'same'}
				</span>
			{/if}
		</dd>
	</div>
</dl>
