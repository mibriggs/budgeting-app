<!--
	@component
	"Cash Flow" Sankey: all income for the chosen period as one block on the left, flowing out to
	the top spending categories, "Other", and whatever was left over. The range picker in the card
	changes the period through the URL (default: last 6 months).
-->
<script lang="ts">
	import { Chart, Link, Svg } from 'layerchart';
	import { Sankey } from 'layerchart/graph';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import type { CashFlow, FlowNode } from '#lib/dashboard.ts';
	import { formatRange, type DateRange } from '#lib/date-range.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import ChartCard from './ChartCard.svelte';

	let { flow, range }: { flow: CashFlow; range: DateRange } = $props();

	const uid = $props.id();

	// Percentages are of everything flowing through: income, or spending when it was higher.
	let total = $derived(Math.max(flow.incomeCents, flow.spendingCents));
	const percent = (cents: number) => (total > 0 ? Math.round((cents / total) * 100) : 0);

	let graph = $derived({
		nodes: flow.nodes.map((n) => ({ ...n, value: n.cents / 100 })),
		links: flow.links.map((l) => ({ ...l, value: l.cents / 100 }))
	});

	// Room for two-line labels between the right-hand blocks.
	let targetCount = $derived(
		flow.nodes.filter((n) => n.kind === 'category' || n.kind === 'leftOver').length
	);
	let height = $derived(Math.max(400, targetCount * 80));

	type LaidOutNode = FlowNode & {
		x0: number;
		x1: number;
		y0: number;
		y1: number;
		depth: number;
		sourceLinks: unknown[];
	};

	/** Where a node's label goes: right of the left column, left of the right column, above the middle. */
	function labelPos(node: LaidOutNode) {
		const mid = (node.y0 + node.y1) / 2;
		if (node.kind === 'spending')
			return { x: (node.x0 + node.x1) / 2, y: node.y0 - 26, anchor: 'middle' };
		if (node.sourceLinks.length > 0) return { x: node.x1 + 10, y: mid - 8, anchor: 'start' };
		return { x: node.x0 - 10, y: mid - 8, anchor: 'end' };
	}

	const label =
		'fill-current text-[13px] [paint-order:stroke] [stroke:var(--chart-gap)] [stroke-width:3px] [stroke-linejoin:round]';
</script>

<ChartCard title="Cash Flow" subtitle={formatRange(range)}>
	{#snippet table()}
		<table class="w-full text-left tabular-nums">
			<thead class="text-gray-500 dark:text-gray-400">
				<tr>
					<th class="py-1 font-medium">From → To</th>
					<th class="py-1 text-right font-medium">Amount</th>
					<th class="py-1 text-right font-medium">Share</th>
				</tr>
			</thead>
			<tbody>
				{#each flow.links as link (link.source + link.target)}
					{@const from = flow.nodes.find((n) => n.id === link.source)}
					{@const to = flow.nodes.find((n) => n.id === link.target)}
					<tr class="border-t border-gray-100 dark:border-gray-800">
						<td class="py-1">{from?.name} → {to?.name}</td>
						<td class="py-1 text-right">{formatCents(link.cents)}</td>
						<td class="py-1 text-right">{percent(link.cents)}%</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}

	<RangePicker {range} path="/" defaultPreset="6m" />

	{#if flow.nodes.length === 0}
		<p class="py-8 text-center text-sm text-gray-500">No income or spending in this period.</p>
	{:else}
		{#if flow.spendingCents > flow.incomeCents}
			<p class="text-xs text-gray-500 dark:text-gray-400">
				Spending was {formatCentsWhole(flow.spendingCents - flow.incomeCents)} more than income in this
				period.
			</p>
		{/if}
		<div style:height="{height}px">
			<Chart
				data={graph}
				padding={{ top: flow.spendingCents > flow.incomeCents ? 34 : 4, bottom: 4 }}
			>
				<Svg>
					<!-- nodeSort keeps the given order (largest category at the top). -->
					<Sankey
						nodeId={(d: FlowNode) => d.id}
						nodeWidth={12}
						nodePadding={40}
						nodeAlign="justify"
						nodeSort={() => 0}
					>
						{#snippet children({ nodes, links })}
							<defs>
								{#each links as link, i (i)}
									<linearGradient
										id="{uid}-link-{i}"
										gradientUnits="userSpaceOnUse"
										x1={link.source.x1}
										x2={link.target.x0}
									>
										<stop offset="0%" stop-color={link.source.color} />
										<stop offset="100%" stop-color={link.target.color} />
									</linearGradient>
								{/each}
							</defs>
							{#each links as link, i (i)}
								<g class="opacity-35 transition-opacity hover:opacity-60">
									<title>
										{link.source.name} → {link.target.name}: {formatCents(link.cents)} ({percent(
											link.cents
										)}%)
									</title>
									<Link
										sankey
										data={link}
										fill="none"
										stroke="url(#{uid}-link-{i})"
										strokeWidth={Math.max(1, link.width)}
									/>
								</g>
							{/each}
							{#each nodes as n (n.id)}
								{@const node = n as unknown as LaidOutNode}
								{@const pos = labelPos(node)}
								<rect
									x={node.x0}
									y={node.y0}
									width={node.x1 - node.x0}
									height={Math.max(1, node.y1 - node.y0)}
									rx="2"
									fill={node.color}
								>
									<title>{node.name}: {formatCents(node.cents)}</title>
								</rect>
								<text
									x={pos.x}
									y={pos.y}
									text-anchor={pos.anchor}
									dominant-baseline="middle"
									class={label}
								>
									<tspan class="font-medium">{node.name}</tspan>
									<tspan x={pos.x} dy="17" class="fill-gray-500 tabular-nums dark:fill-gray-400">
										{formatCentsWhole(node.cents)}{node.kind === 'income' ||
										node.kind === 'spending'
											? ''
											: ` (${percent(node.cents)}%)`}
									</tspan>
								</text>
							{/each}
						{/snippet}
					</Sankey>
				</Svg>
			</Chart>
		</div>
	{/if}
</ChartCard>
