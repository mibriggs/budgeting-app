<!--
	@component
	"On pace?": running total of spending by day of the month, this month (accent, up to today)
	against last month (gray, context). Above last month's line means spending faster.
-->
<script lang="ts">
	import { LineChart } from 'layerchart';
	import { CHART_PADDING, type PacePoint } from '#lib/dashboard.ts';
	import { formatAxisDollars, formatCents, formatDollars } from '#lib/money.ts';
	import ChartCard from './ChartCard.svelte';

	let {
		points,
		thisMonthLabel,
		lastMonthLabel
	}: { points: PacePoint[]; thisMonthLabel: string; lastMonthLabel: string } = $props();

	let data = $derived(
		points.map((p) => ({
			day: p.day,
			thisMonth: p.thisMonth === null ? null : p.thisMonth / 100,
			lastMonth: p.lastMonth === null ? null : p.lastMonth / 100
		}))
	);
	// The last day this month has data for (today), for the table.
	let latest = $derived(points.findLast((p) => p.thisMonth !== null));
</script>

<ChartCard title="On pace?" subtitle="Spending so far, by day of the month">
	{#snippet table()}
		<table class="w-full text-left tabular-nums">
			<thead class="text-gray-500 dark:text-gray-400">
				<tr>
					<th class="py-1 font-medium">Day</th>
					<th class="py-1 text-right font-medium">{thisMonthLabel}</th>
					<th class="py-1 text-right font-medium">{lastMonthLabel}</th>
				</tr>
			</thead>
			<tbody>
				{#each points as p (p.day)}
					<tr class="border-t border-gray-100 dark:border-gray-800">
						<td class="py-1">{p.day}</td>
						<td class="py-1 text-right">{p.thisMonth === null ? '' : formatCents(p.thisMonth)}</td>
						<td class="py-1 text-right">{p.lastMonth === null ? '' : formatCents(p.lastMonth)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}
	<div class="h-60">
		<LineChart
			{data}
			x="day"
			series={[
				// Last month first, so this month's line is drawn on top of it. Both 2px.
				{
					key: 'lastMonth',
					label: lastMonthLabel,
					color: 'var(--chart-other)',
					props: {
						class: 'stroke-2',
						defined: (d: { lastMonth: number | null }) => d.lastMonth !== null
					}
				},
				{
					key: 'thisMonth',
					label: thisMonthLabel,
					color: 'var(--chart-1)',
					props: {
						class: 'stroke-2',
						defined: (d: { thisMonth: number | null }) => d.thisMonth !== null
					}
				}
			]}
			legend
			padding={CHART_PADDING}
			props={{
				yAxis: { format: formatAxisDollars },
				xAxis: { format: (day: number) => String(day) },
				tooltip: { item: { format: formatDollars } }
			}}
		/>
	</div>
	{#if latest}
		<p class="text-xs text-gray-500 dark:text-gray-400">
			{formatCents(latest.thisMonth ?? 0)} by day {latest.day}, vs. {formatCents(
				points[latest.day - 1]?.lastMonth ?? 0
			)} last month.
		</p>
	{/if}
</ChartCard>
