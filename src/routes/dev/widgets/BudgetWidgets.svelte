<!--
	@component
	Mock of a "Budget" Home Screen widget in small, medium and large, after a ring-style ad the
	user liked (2026-11-25). A big ring for all of this month's budgets together, all spending
	beside it (budgets don't cover every category), and the top categories by spending, each with a
	small ring around its icon.

	Uses only what `/api/widget` sends today plus one proposed field, `budget` (limits added up, and
	the spending in budgeted categories). Each category's status comes from its own limit:
	- over: spent more than the limit (red)
	- close: 80% or more used, unless exactly at the limit, which reads as paid in full (amber)
	- ok: everything else (green); no limit: a plain icon and "No budget"
	The home page also flags everyday budgets spending too fast; that needs a per-category flag the
	endpoint doesn't send, so the widget leaves it out.

	In Scriptable the rings would be images drawn with DrawContext (an arc is a Path of short
	lines), set as a stack's backgroundImage so the percent or icon sits on top as normal text.
	Must render inside the page's `.home` section, which sets the colour variables.
-->
<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import type { Component } from 'svelte';
	import { categoryIcon } from '#lib/category-icons.ts';
	import type { WidgetData } from './+page.server';

	let {
		widget,
		monthShort,
		updated,
		problem,
		notice
	}: {
		widget: WidgetData;
		monthShort: string;
		updated: string;
		problem: { icon: Component; title: string; body: string } | null;
		notice: { icon: Component; text: string } | null;
	} = $props();

	type Category = WidgetData['topCategories'][number];
	type Status = 'over' | 'close' | 'ok';

	// Whole dollars ("$2,983"); compact from $10,000 ("$12.4K"), or from $1,000 where space is short.
	const whole = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});
	const compact = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		notation: 'compact',
		maximumFractionDigits: 1
	});
	const money = (cents: number) =>
		Math.abs(cents) < 1_000_000
			? whole.format(Math.round(cents / 100))
			: compact.format(cents / 100);
	const short = (cents: number) =>
		Math.abs(cents) < 100_000 ? whole.format(Math.round(cents / 100)) : compact.format(cents / 100);
	const pct = (share: number) => `${Math.round(share * 100)}%`;

	function status(spent: number, limit: number): Status {
		if (spent > limit) return 'over';
		if (spent === limit) return 'ok';
		return spent / limit >= 0.8 ? 'close' : 'ok';
	}
	const color = (s: Status) =>
		s === 'over' ? 'var(--ring-over)' : s === 'ok' ? 'var(--ring-ok)' : 'var(--ring-warn)';

	const rows = $derived([...widget.topCategories, ...widget.moreCategories]);
	const hasBudgets = $derived(widget.budget.limitCents > 0);
	const share = $derived(hasBudgets ? widget.budget.spentCents / widget.budget.limitCents : 0);
	const ringStatus = $derived(
		hasBudgets ? status(widget.budget.spentCents, widget.budget.limitCents) : 'ok'
	);
	const notBudgeted = $derived(widget.net.expenseCents - widget.budget.spentCents);

	// The script would work this out from the phone's date; the mock uses `asOf`.
	const daysLeft = $derived.by(() => {
		const [y, m] = widget.month.split('-').map(Number);
		const day = Number(widget.asOf.slice(8, 10));
		return new Date(y, m, 0).getDate() - day;
	});

	function note(c: Category) {
		if (c.limitCents === null || c.leftCents === null) return 'No budget';
		if (c.leftCents < 0) return `${short(-c.leftCents)} over`;
		if (c.leftCents === 0) return 'All used';
		return `${short(c.leftCents)} left`;
	}
</script>

<!-- A progress ring. Past 100% it's simply full (and red). -->
{#snippet ring(size: number, stroke: number, fill: number, s: Status)}
	{@const r = (size - stroke) / 2}
	{@const c = 2 * Math.PI * r}
	{@const shown = Math.min(Math.max(fill, 0), 1)}
	<svg width={size} height={size} viewBox="0 0 {size} {size}" class="absolute inset-0 -rotate-90">
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke={hasBudgets ? color(s) : 'var(--muted)'}
			stroke-opacity="0.22"
			stroke-width={stroke}
		/>
		{#if shown > 0}
			<circle
				cx={size / 2}
				cy={size / 2}
				{r}
				fill="none"
				stroke={color(s)}
				stroke-width={stroke}
				stroke-linecap="round"
				stroke-dasharray="{c * shown} {c}"
			/>
		{/if}
	</svg>
{/snippet}

<!-- The month's ring with the percent inside. -->
{#snippet bigRing(size: number, stroke: number)}
	<div
		class="figures relative flex shrink-0 items-center justify-center"
		style:width="{size}px"
		style:height="{size}px"
		role="img"
		aria-label={hasBudgets ? `${pct(share)} of the budget used` : 'No budgets set'}
	>
		{@render ring(size, stroke, share, ringStatus)}
		<span
			class={[
				'font-semibold tabular-nums',
				size >= 70 ? 'text-[17px]' : size >= 50 ? 'text-[14px]' : 'text-[12px]'
			]}>{hasBudgets ? pct(share) : '—'}</span
		>
	</div>
{/snippet}

<!-- A category's icon: in a ring when it has a budget, in a plain circle when it doesn't. -->
{#snippet chipRing(c: Category, size: number)}
	{@const Icon = categoryIcon(c.icon)}
	{@const s = c.limitCents === null ? null : status(c.spentCents, c.limitCents)}
	<div
		class={[
			'relative flex shrink-0 items-center justify-center rounded-full',
			s === null && 'bg-(--chip)'
		]}
		style:width="{size}px"
		style:height="{size}px"
		aria-hidden="true"
	>
		{#if s !== null && c.limitCents !== null}
			{@render ring(size, size < 26 ? 2.5 : 3, c.spentCents / c.limitCents, s)}
			<Icon class={size < 26 ? 'size-3' : 'size-3.5'} style="color: {color(s)}" />
		{:else}
			<Icon class={['text-(--muted)', size < 26 ? 'size-3' : 'size-3.5']} />
		{/if}
	</div>
{/snippet}

{#snippet footer()}
	{#if notice}
		<span class="flex items-center gap-1 text-[10px] font-medium text-(--warn)">
			<notice.icon class="size-2.5 shrink-0" aria-hidden="true" />
			<span class="truncate">{notice.text}</span>
		</span>
	{:else}
		<span class="flex items-center gap-1 text-[10px] text-(--muted)">
			<Clock class="size-2.5 shrink-0" aria-hidden="true" />
			<span class="truncate">{daysLeft} days left · {updated}</span>
		</span>
	{/if}
{/snippet}

{#snippet problemView(size: 'sm' | 'md')}
	{#if problem}
		<div
			class={[
				'flex flex-1 items-center gap-3',
				size === 'sm' ? 'flex-col justify-center text-center' : ''
			]}
		>
			<span
				class="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--chip) text-(--muted)"
			>
				<problem.icon class="size-5" aria-hidden="true" />
			</span>
			<div class="flex flex-col gap-0.5">
				<span class="text-[13px] leading-tight font-semibold">{problem.title}</span>
				<span class="text-[11px] leading-tight text-(--muted)">{problem.body}</span>
			</div>
		</div>
	{/if}
{/snippet}

<!-- Ring, "spent of budget", and all spending at the right. Shared by medium and large. -->
{#snippet hero(size: 'medium' | 'large')}
	<div class="flex items-center gap-3">
		{@render bigRing(size === 'large' ? 76 : 44, size === 'large' ? 8 : 5)}
		<div class="flex min-w-0 flex-1 flex-col">
			<!-- Medium has no title line (room for three rows); the month moves into the budget line. -->
			{#if size === 'large'}
				<span class="text-[11px] font-semibold text-(--muted)">Budget · {monthShort}</span>
			{/if}
			{#if hasBudgets}
				<span
					class={[
						'figures leading-tight font-semibold tracking-tight tabular-nums',
						size === 'large' ? 'text-[24px]' : 'text-[20px]'
					]}>{money(widget.budget.spentCents)}</span
				>
				<span class="figures truncate text-xs text-(--muted)"
					>of {money(widget.budget.limitCents)}
					{size === 'large' ? 'budget' : `${monthShort} budget`}</span
				>
			{:else}
				<span class="text-[15px] leading-tight font-semibold">No budgets set</span>
				<span class="truncate text-xs text-(--muted)">Settings → Budgets</span>
			{/if}
			<div class="mt-0.5">{@render footer()}</div>
		</div>
		<div class="figures flex flex-col items-end self-start text-right">
			<span class="text-[13px] font-semibold tabular-nums">{money(widget.net.expenseCents)}</span>
			<span class="text-[10px] leading-tight text-(--muted)">all spending</span>
		</div>
	</div>
{/snippet}

<!-- withNote: large (28pt rings, a note under the name); without: medium's compact rows. -->
{#snippet row(c: Category, withNote: boolean)}
	{@const s = c.limitCents === null ? null : status(c.spentCents, c.limitCents)}
	<li class={['flex items-center', withNote ? 'gap-2.5 text-[13px]' : 'gap-2 text-[12px]']}>
		{@render chipRing(c, withNote ? 28 : 22)}
		<div class="min-w-0 flex-1">
			<div class="truncate leading-tight font-medium">{c.name}</div>
			{#if withNote}
				<div
					class={[
						'truncate text-[11px] leading-tight',
						s === 'over' ? 'text-(--ring-over)' : s === 'close' ? 'text-(--warn)' : 'text-(--muted)'
					]}
				>
					{note(c)}
				</div>
			{/if}
		</div>
		<span class="whitespace-nowrap tabular-nums">
			<span class="font-semibold">{short(c.spentCents)}</span>
			{#if c.limitCents !== null}
				<span class="text-(--muted)">of {short(c.limitCents)}</span>
			{:else if !withNote}
				<span class="text-(--muted)">no budget</span>
			{/if}
		</span>
	</li>
{/snippet}

{#snippet nothingYet()}
	<p class="flex flex-1 items-center justify-center text-xs text-(--muted)">
		No spending yet in {monthShort}
	</p>
{/snippet}

<!-- Small: the ring and the month's numbers; no categories. -->
<article class="bw small flex flex-col p-3" aria-label="Budget, small">
	{#if problem}
		{@render problemView('sm')}
	{:else}
		<span class="text-xs font-semibold"
			>Budget <span class="font-normal text-(--muted)">· {monthShort}</span></span
		>
		<div class="mt-2 flex items-center gap-2.5">
			{@render bigRing(60, 7)}
			<div class="figures flex min-w-0 flex-col">
				{#if hasBudgets}
					<span class="text-[17px] leading-tight font-semibold tabular-nums"
						>{short(widget.budget.spentCents)}</span
					>
					<span class="text-[11px] leading-tight text-(--muted)"
						>of {short(widget.budget.limitCents)}</span
					>
				{:else}
					<span class="text-[13px] leading-tight font-semibold">No budgets</span>
				{/if}
			</div>
		</div>
		<div class="figures mt-auto flex items-baseline justify-between text-[11px]">
			<span class="text-(--muted)">All spending</span>
			<span class="font-semibold tabular-nums">{short(widget.net.expenseCents)}</span>
		</div>
		<div class="mt-0.5">{@render footer()}</div>
	{/if}
</article>

<!-- Medium: the month, then the top three categories by spending. -->
<article class="bw medium flex flex-col justify-between p-3" aria-label="Budget, medium">
	{#if problem}
		{@render problemView('md')}
	{:else}
		{@render hero('medium')}
		{#if rows.length === 0}
			{@render nothingYet()}
		{:else}
			<ul class={['figures flex flex-col gap-1', rows.length === 1 && 'flex-1 justify-center']}>
				{#each rows.slice(0, 3) as c (c.rank)}
					{@render row(c, false)}
				{/each}
			</ul>
		{/if}
	{/if}
</article>

<!-- Large: the month, then the top five categories with a note each, then what has no budget. -->
<article class="bw large flex flex-col p-3.5" aria-label="Budget, large">
	{#if problem}
		{@render problemView('md')}
	{:else}
		{@render hero('large')}
		<div class="mt-3 flex flex-1 flex-col border-t border-(--chip) pt-3">
			{#if rows.length === 0}
				{@render nothingYet()}
			{:else}
				<!-- Five fill the space; fewer stay at the top at the same spacing. -->
				<ul
					class={[
						'figures flex flex-1 flex-col',
						rows.length >= 5 ? 'justify-between' : 'justify-start gap-3'
					]}
				>
					{#each rows.slice(0, 5) as c (c.rank)}
						{@render row(c, true)}
					{/each}
				</ul>
			{/if}
		</div>
		<div
			class="figures mt-2.5 flex items-baseline justify-between border-t border-(--chip) pt-2 text-[11px]"
		>
			<span class="text-(--muted)">Not budgeted</span>
			<span class="font-semibold tabular-nums">{short(notBudgeted)}</span>
		</div>
	{/if}
</article>

<style>
	.bw {
		--ring-ok: #22c55e;
		--ring-warn: #f59e0b;
		--ring-over: #ef4444;
		background: var(--bg);
		color: var(--fg);
		border-radius: 22px;
		height: 158px;
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
	}
	.small {
		width: 158px;
	}
	.medium {
		width: 338px;
	}
	.large {
		width: 338px;
		height: 354px;
	}
</style>
