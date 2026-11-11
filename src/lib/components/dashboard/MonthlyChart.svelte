<!--
	@component
	Income vs. expenses per month, as paired columns on one dollar axis. Net per month is in the
	table view (a second axis or an overlaid line would fight the columns for the same scale).
-->
<script lang="ts">
	import { BarChart } from 'layerchart';
	import { CHART_PADDING, type MonthTotals } from '#lib/dashboard.ts';
	import { formatAxisDollars, formatCents, formatDollars } from '#lib/money.ts';
	import ChartCard from './ChartCard.svelte';

	let { months }: { months: MonthTotals[] } = $props();

	let data = $derived(
		months.map((m) => ({ label: m.label, income: m.income / 100, expenses: m.expenses / 100 }))
	);
</script>

<ChartCard title="Income vs. expenses" subtitle="Last {months.length} months">
	{#snippet table()}
		<table class="w-full text-left tabular-nums">
			<thead class="text-gray-500 dark:text-gray-400">
				<tr>
					<th class="py-1 font-medium">Month</th>
					<th class="py-1 text-right font-medium">Income</th>
					<th class="py-1 text-right font-medium">Expenses</th>
					<th class="py-1 text-right font-medium">Net</th>
				</tr>
			</thead>
			<tbody>
				{#each months as m (m.month)}
					<tr class="border-t border-gray-100 dark:border-gray-800">
						<td class="py-1">{m.label}</td>
						<td class="py-1 text-right">{formatCents(m.income)}</td>
						<td class="py-1 text-right">{formatCents(m.expenses)}</td>
						<td class="py-1 text-right">{formatCents(m.net)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}
	<div class="h-60">
		<BarChart
			{data}
			x="label"
			series={[
				{ key: 'income', label: 'Income', color: 'var(--chart-1)' },
				{ key: 'expenses', label: 'Expenses', color: 'var(--chart-2)' }
			]}
			seriesLayout="group"
			legend
			padding={CHART_PADDING}
			props={{
				yAxis: { format: formatAxisDollars },
				tooltip: { item: { format: formatDollars } }
			}}
		/>
	</div>
</ChartCard>
