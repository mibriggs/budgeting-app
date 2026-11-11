<!--
	@component
	"Spending by category" with a Pie | Bars switch in the card header. The choice is remembered on
	this device (localStorage); it's a viewing preference, so it isn't saved to the account.
-->
<script lang="ts">
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import { Tabs } from 'bits-ui';
	import type { CategorySlice } from '#lib/dashboard.ts';
	import CategoryBars from './CategoryBars.svelte';
	import CategoryDonut from './CategoryDonut.svelte';
	import ChartCard from './ChartCard.svelte';

	let {
		rows,
		slices,
		subtitle
	}: {
		/** Every category with spending, largest first (for the bars). */
		rows: CategorySlice[];
		/** Top categories plus "Other" (for the pie). */
		slices: CategorySlice[];
		subtitle: string;
	} = $props();

	type View = 'pie' | 'bars';
	const STORAGE_KEY = 'category-chart';

	let view = $state<View>('pie');

	// Read the saved choice after mount (the server always renders the pie first).
	$effect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved === 'pie' || saved === 'bars') view = saved;
		} catch {
			// Storage blocked: keep the default.
		}
	});

	function select(value: string) {
		if (value !== 'pie' && value !== 'bars') return;
		view = value;
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			// Storage blocked: the switch still works for this visit.
		}
	}

	const trigger =
		'flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 transition hover:text-gray-900 data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:text-gray-400 dark:hover:text-gray-100 dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900';
</script>

<Tabs.Root value={view} onValueChange={select}>
	<!-- h-full: as tall as the Budgets card beside it on wide screens. -->
	<ChartCard title="Spending by category" {subtitle} class="h-full">
		{#snippet actions()}
			<Tabs.List
				aria-label="Chart type"
				class="flex shrink-0 gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
			>
				<Tabs.Trigger value="pie" class={trigger}>
					<ChartPie class="size-3.5" aria-hidden="true" />
					Pie
				</Tabs.Trigger>
				<Tabs.Trigger value="bars" class={trigger}>
					<ChartBar class="size-3.5" aria-hidden="true" />
					Bars
				</Tabs.Trigger>
			</Tabs.List>
		{/snippet}

		{#if rows.length === 0}
			<p class="py-8 text-center text-sm text-gray-500">No spending yet this month.</p>
		{:else}
			<!-- Both views share one grid cell and both stay laid out, so the card is always the taller
			     view's height and doesn't jump when switching. The inactive one is invisible and inert
			     (not clickable, focusable or read out) instead of `hidden`, which would remove it from
			     layout. The `child` snippet keeps Bits' tab-panel role and ids. -->
			<div class="grid">
				<Tabs.Content value="pie">
					{#snippet child({ props })}
						<div
							{...props}
							hidden={undefined}
							inert={view !== 'pie'}
							class={['col-start-1 row-start-1 flex items-center', view !== 'pie' && 'invisible']}
						>
							<CategoryDonut {slices} />
						</div>
					{/snippet}
				</Tabs.Content>
				<Tabs.Content value="bars">
					{#snippet child({ props })}
						<div
							{...props}
							hidden={undefined}
							inert={view !== 'bars'}
							class={['col-start-1 row-start-1', view !== 'bars' && 'invisible']}
						>
							<CategoryBars {rows} />
						</div>
					{/snippet}
				</Tabs.Content>
			</div>
		{/if}
	</ChartCard>
</Tabs.Root>
