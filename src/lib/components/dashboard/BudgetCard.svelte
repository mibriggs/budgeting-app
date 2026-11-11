<!--
	@component
	Home page "Budgets" card: how this month's spending compares with each category's limit.
	Two views behind a Tiles | List switch (remembered on this device, like Pie | Bars):
	- Tiles: counts (over / at risk / on track), then a small tile per budget.
	- List: a row per budget with "$412 of $600", a bar, and a note; plus the total.
	Status rules live in src/lib/budget-status.ts. Everyday categories get a tick on their bar
	for where even spending would be today; bills paid once a month don't.
-->
<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import List from '@lucide/svelte/icons/list';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { Tabs } from 'bits-ui';
	import { resolve } from '$app/paths';
	import {
		PROJECT_FROM_DAY,
		type BudgetLine,
		type BudgetStatus,
		type BudgetSummary
	} from '#lib/budget-status.ts';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatCentsWhole } from '#lib/money.ts';
	import ChartCard from './ChartCard.svelte';

	let { summary, subtitle }: { summary: BudgetSummary; subtitle: string } = $props();

	type View = 'tiles' | 'list';
	const STORAGE_KEY = 'budget-view';
	/**
	 * Shown before "Show all": two rows of three tiles, or four list rows (list rows are taller;
	 * this keeps both views about the same height, so the card has no empty gap).
	 */
	const VISIBLE = { tiles: 6, list: 4 };

	let view = $state<View>('tiles');
	let showAll = $state(false);

	// Read the saved choice after mount (the server always renders tiles first).
	$effect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved === 'tiles' || saved === 'list') view = saved;
		} catch {
			// Storage blocked: keep the default.
		}
	});

	function select(value: string) {
		if (value !== 'tiles' && value !== 'list') return;
		view = value;
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			// Storage blocked: the switch still works for this visit.
		}
	}

	const shown = (v: View) => (showAll ? summary.lines : summary.lines.slice(0, VISIBLE[v]));
	let pace = $derived(summary.day / summary.daysInMonth);
	let totalShare = $derived(summary.totalLimit > 0 ? summary.totalSpent / summary.totalLimit : 0);

	const pct = (share: number) => (Number.isFinite(share) ? `${Math.round(share * 100)}%` : '—');
	const width = (share: number) => `${Math.min(Math.max(share, 0), 1) * 100}%`;
	const fill = (status: BudgetStatus) =>
		status === 'over'
			? 'var(--status-critical)'
			: status === 'ok'
				? 'var(--chart-1)'
				: 'var(--status-warning)';
	const track = (color: string) => `color-mix(in oklab, ${color} var(--track), transparent)`;
	const leftText = (l: BudgetLine) =>
		l.left >= 0 ? `${formatCentsWhole(l.left)} left` : `${formatCentsWhole(-l.left)} over`;

	function note(l: BudgetLine) {
		if (l.status === 'over') return `Over by ${formatCentsWhole(-l.left)}`;
		if (l.left === 0 && l.limit > 0) return 'All of it used';
		if (l.status === 'heading' && l.projected !== null)
			return `${leftText(l)} · about ${formatCentsWhole(l.projected)} by month end at this rate`;
		if (l.everyday && summary.day >= PROJECT_FROM_DAY) return `${leftText(l)} · on pace`;
		return leftText(l);
	}

	const describe = (l: BudgetLine) =>
		`${l.name}: ${formatCentsWhole(l.spent)} of ${formatCentsWhole(l.limit)} (${pct(l.share)}). ${note(l)}.`;

	const label: Record<BudgetStatus, string> = {
		over: 'Over',
		close: 'Close',
		heading: 'Heading over',
		ok: 'On track'
	};

	const trigger =
		'flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 transition hover:text-gray-900 data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:text-gray-400 dark:hover:text-gray-100 dark:data-[state=active]:bg-white dark:data-[state=active]:text-gray-900';
</script>

<!-- Status in words with an icon, never colour alone. Text stays in text colours. -->
{#snippet tag(status: BudgetStatus)}
	<span
		class={[
			'inline-flex items-center gap-1 text-xs whitespace-nowrap',
			status === 'over' && 'text-red-700 dark:text-red-400',
			(status === 'close' || status === 'heading') && 'text-amber-800 dark:text-amber-300',
			status === 'ok' && 'text-gray-500 dark:text-gray-400'
		]}
	>
		{#if status === 'over'}
			<CircleAlert class="size-3.5" aria-hidden="true" />
		{:else if status === 'ok'}
			<CircleCheck class="size-3.5" aria-hidden="true" />
		{:else}
			<TriangleAlert class="size-3.5" aria-hidden="true" />
		{/if}
		{label[status]}
	</span>
{/snippet}

<!-- A bar on a pale track of its own colour; everyday budgets get a tick at today's even pace. -->
{#snippet meter(l: BudgetLine, height: string)}
	<div
		class="relative {height} w-full rounded-full"
		style:background-color={track(fill(l.status))}
		role="img"
		aria-label={describe(l)}
		title={describe(l)}
	>
		<div
			class="h-full rounded-full"
			style:width={width(l.share)}
			style:background-color={fill(l.status)}
		></div>
		{#if l.everyday}
			<div
				class="absolute -inset-y-1 w-0.5 rounded-full bg-gray-900 dark:bg-gray-100"
				style:left={width(pace)}
				aria-hidden="true"
			></div>
		{/if}
	</div>
{/snippet}

{#snippet showMore(v: View)}
	{#if summary.lines.length > VISIBLE[v]}
		<button
			type="button"
			class="self-start text-xs text-gray-600 underline-offset-2 hover:underline dark:text-gray-300"
			aria-expanded={showAll}
			onclick={() => (showAll = !showAll)}
		>
			{showAll ? 'Show fewer' : `Show all ${summary.lines.length}`}
		</button>
	{/if}
{/snippet}

{#snippet table()}
	<table class="w-full text-left tabular-nums">
		<thead class="text-gray-500 dark:text-gray-400">
			<tr>
				<th class="py-1 font-medium">Category</th>
				<th class="py-1 text-right font-medium">Spent</th>
				<th class="py-1 text-right font-medium">Budget</th>
				<th class="py-1 text-right font-medium">Used</th>
				<th class="py-1 pl-2 font-medium">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each summary.lines as l (l.id)}
				<tr class="border-t border-gray-100 dark:border-gray-800">
					<td class="py-1">{l.name}</td>
					<td class="py-1 text-right">{formatCentsWhole(l.spent)}</td>
					<td class="py-1 text-right">{formatCentsWhole(l.limit)}</td>
					<td class="py-1 text-right">{pct(l.share)}</td>
					<td class="py-1 pl-2">{label[l.status]}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/snippet}

<Tabs.Root value={view} onValueChange={select}>
	<ChartCard
		title="Budgets"
		{subtitle}
		table={summary.lines.length > 0 ? table : undefined}
		class="h-full"
	>
		{#snippet actions()}
			{#if summary.lines.length > 0}
				<Tabs.List
					aria-label="Budget view"
					class="flex shrink-0 gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
				>
					<Tabs.Trigger value="tiles" class={trigger}>
						<LayoutGrid class="size-3.5" aria-hidden="true" />
						Tiles
					</Tabs.Trigger>
					<Tabs.Trigger value="list" class={trigger}>
						<List class="size-3.5" aria-hidden="true" />
						List
					</Tabs.Trigger>
				</Tabs.List>
			{/if}
		{/snippet}

		{#if summary.lines.length === 0}
			<div class="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
				<p class="text-sm text-gray-500 dark:text-gray-400">No budgets set yet.</p>
				<a
					href={resolve('/settings/budgets')}
					class="press rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
				>
					Set budgets
				</a>
			</div>
		{:else}
			<!-- Both views share one grid cell so the card keeps the taller one's height and doesn't
			     jump when switching (same approach as Spending by category). -->
			<div class="grid">
				<Tabs.Content value="tiles">
					{#snippet child({ props })}
						<div
							{...props}
							hidden={undefined}
							inert={view !== 'tiles'}
							class={[
								'col-start-1 row-start-1 flex flex-col gap-3',
								view !== 'tiles' && 'invisible'
							]}
						>
							<dl class="grid grid-cols-3 gap-2 text-center">
								<div class="rounded-md border border-gray-200 py-2 dark:border-gray-800">
									<dd class="text-xl font-semibold tabular-nums">{summary.counts.over}</dd>
									<dt class="flex justify-center">{@render tag('over')}</dt>
								</div>
								<div class="rounded-md border border-gray-200 py-2 dark:border-gray-800">
									<dd class="text-xl font-semibold tabular-nums">{summary.counts.atRisk}</dd>
									<dt
										class="flex items-center justify-center gap-1 text-xs text-amber-800 dark:text-amber-300"
									>
										<TriangleAlert class="size-3.5" aria-hidden="true" />
										At risk
									</dt>
								</div>
								<div class="rounded-md border border-gray-200 py-2 dark:border-gray-800">
									<dd class="text-xl font-semibold tabular-nums">{summary.counts.ok}</dd>
									<dt class="flex justify-center">{@render tag('ok')}</dt>
								</div>
							</dl>
							<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3">
								{#each shown('tiles') as l (l.id)}
									{@const Icon = categoryIcon(l.icon)}
									<li
										class="flex flex-col gap-1.5 rounded-md border border-gray-200 p-2.5 dark:border-gray-800"
									>
										<span
											class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
										>
											<Icon class="size-3.5 shrink-0" aria-hidden="true" />
											<span class="truncate">{l.name}</span>
										</span>
										<span class="text-lg leading-none font-semibold tabular-nums">
											{pct(l.share)}
										</span>
										{@render meter(l, 'h-1.5')}
										<span
											class="flex flex-wrap items-center justify-between gap-1 text-xs text-gray-500 tabular-nums dark:text-gray-400"
										>
											{leftText(l)}
											{@render tag(l.status)}
										</span>
									</li>
								{/each}
							</ul>
							{@render showMore('tiles')}
						</div>
					{/snippet}
				</Tabs.Content>
				<Tabs.Content value="list">
					{#snippet child({ props })}
						<div
							{...props}
							hidden={undefined}
							inert={view !== 'list'}
							class={[
								'col-start-1 row-start-1 flex flex-col gap-3',
								view !== 'list' && 'invisible'
							]}
						>
							<ul class="flex flex-col gap-3">
								{#each shown('list') as l (l.id)}
									{@const Icon = categoryIcon(l.icon)}
									<li class="flex flex-col gap-1">
										<div class="flex items-center gap-2 text-sm">
											<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
											<span class="min-w-0 flex-1 truncate">{l.name}</span>
											<span class="tabular-nums">
												{formatCentsWhole(l.spent)}
												<span class="text-gray-500 dark:text-gray-400"
													>of {formatCentsWhole(l.limit)}</span
												>
											</span>
											<span class="w-10 text-right font-medium tabular-nums">{pct(l.share)}</span>
										</div>
										{@render meter(l, 'h-2')}
										<div class="flex items-center justify-between gap-2">
											<p class="min-w-0 text-xs text-gray-500 dark:text-gray-400">{note(l)}</p>
											{@render tag(l.status)}
										</div>
									</li>
								{/each}
							</ul>
							{@render showMore('list')}
							<p
								class="flex justify-between border-t border-gray-100 pt-2 text-sm dark:border-gray-800"
							>
								<span class="font-medium">Total</span>
								<span class="tabular-nums">
									{formatCentsWhole(summary.totalSpent)}
									<span class="text-gray-500 dark:text-gray-400"
										>of {formatCentsWhole(summary.totalLimit)}</span
									>
									· {pct(totalShare)}
								</span>
							</p>
							{#if summary.unbudgeted.length > 0}
								<p class="text-xs text-gray-500 dark:text-gray-400">
									No budget: {summary.unbudgeted
										.map((c) => `${c.name} ${formatCentsWhole(c.spent)}`)
										.join(', ')}
								</p>
							{/if}
						</div>
					{/snippet}
				</Tabs.Content>
			</div>
			<div
				class="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400"
			>
				<span class="flex items-center gap-1.5">
					<span class="h-3 w-0.5 rounded-full bg-gray-900 dark:bg-gray-100" aria-hidden="true"
					></span>
					Even pace for day {summary.day} of {summary.daysInMonth}
				</span>
				<a
					href={resolve('/settings/budgets')}
					class="text-gray-600 underline-offset-2 hover:underline dark:text-gray-300"
				>
					Edit budgets
				</a>
			</div>
		{/if}
	</ChartCard>
</Tabs.Root>
