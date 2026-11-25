<!--
	Mock of the two Home Screen widgets (top spending, net cash flow), in small and medium
	iPhone sizes (158×158 and 338×158 points). The real ones will be drawn by a Scriptable script
	from `/api/widget`; this page only settles the look and what the endpoint must return.
	Icons are Lucide stand-ins for the SF Symbols the script would use.

	"State" covers what the script shows when things go wrong: it keeps the last good response
	on the phone and shows that (dimmed, with why) when it can't get a new one.
-->
<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Clock from '@lucide/svelte/icons/clock';
	import CloudOff from '@lucide/svelte/icons/cloud-off';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Minus from '@lucide/svelte/icons/minus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import WifiOff from '@lucide/svelte/icons/wifi-off';
	import { categoryIcon } from '#lib/category-icons.ts';
	import type { PageProps } from './$types';
	import type { WidgetData } from './+page.server';
	import BudgetWidgets from './BudgetWidgets.svelte';

	let { data }: PageProps = $props();

	let scenario = $state<'earned' | 'spent'>('spent');
	let theme = $state<'dark' | 'light'>('dark');
	let detail = $state<'budget' | 'share'>('share');
	let layout = $state<'bars' | 'list'>('bars');

	type Status =
		'live' | 'offline' | 'error' | 'stale' | 'no-cache' | 'token' | 'empty' | 'some' | 'few';
	let status = $state<Status>('live');
	const STATUSES: [Status, string][] = [
		['live', 'Up to date'],
		['offline', 'Offline, showing last data'],
		['error', 'Server error or bad response, showing last data'],
		['stale', 'Last data is from yesterday'],
		['no-cache', 'Offline, nothing saved yet'],
		['token', 'Token revoked or wrong'],
		['empty', 'New month, nothing spent yet'],
		['some', 'Three categories so far'],
		['few', 'Only one category so far']
	];

	const base: WidgetData = $derived(scenario === 'earned' ? data.earnedMore : data.spentMore);
	/** Only these categories have spending: totals and shares follow, as the endpoint would. */
	function onlyThese(categories: WidgetData['topCategories']): WidgetData {
		const spent = categories.reduce((sum, c) => sum + c.spentCents, 0);
		const ranked = categories.map((c, i) => ({
			...c,
			rank: i + 1,
			shareOfSpending: spent ? c.spentCents / spent : 0
		}));
		return {
			...base,
			asOf: categories.length ? base.asOf : '2026-12-01T08:05:00-05:00',
			topCategories: ranked.slice(0, 3),
			moreCategories: ranked.slice(3),
			net: {
				incomeCents: base.net.incomeCents,
				expenseCents: spent,
				netCents: base.net.incomeCents - spent
			},
			budget: {
				limitCents: base.budget.limitCents,
				spentCents: ranked.reduce((sum, c) => sum + (c.limitCents === null ? 0 : c.spentCents), 0)
			}
		};
	}

	const widget: WidgetData = $derived.by(() => {
		if (status === 'empty')
			return {
				...onlyThese([]),
				month: '2026-12',
				monthLabel: 'Dec 2026',
				net: { incomeCents: 0, expenseCents: 0, netCents: 0 }
			};
		const all = [...base.topCategories, ...base.moreCategories];
		if (status === 'some') return onlyThese(all.slice(0, 3));
		if (status === 'few') return onlyThese(all.slice(1, 2));
		return base;
	});

	// What the script will do: full dollars and cents under $1,000, compact above ("$2.3K").
	const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
	const compact = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		notation: 'compact',
		maximumFractionDigits: 1,
		minimumFractionDigits: 1
	});
	const money = (cents: number) =>
		Math.abs(cents) < 100_000 ? usd.format(cents / 100) : compact.format(cents / 100);

	// Budget lines are a rough guide, so whole dollars ("$48 left of $400").
	const whole = new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 0
	});
	const roughMoney = (cents: number) =>
		Math.abs(cents) < 100_000 ? whole.format(Math.round(cents / 100)) : compact.format(cents / 100);

	const updated = $derived(
		new Date(widget.asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
	);
	const direction = $derived(
		widget.net.netCents > 0 ? 'up' : widget.net.netCents < 0 ? 'down' : 'flat'
	);
	const max = $derived(Math.max(widget.net.incomeCents, widget.net.expenseCents, 1));
	const monthShort = $derived(widget.monthLabel.split(' ')[0]);
	// Small, medium and the Lock Screen show the top 3; large shows up to 7.
	const top3 = $derived(widget.topCategories);
	const top7 = $derived([...widget.topCategories, ...widget.moreCategories]);
	// Large net widget: the last 6 months, earned and spent, against the biggest of them.
	const monthsMax = $derived(
		Math.max(1, ...widget.months.map((m) => Math.max(m.incomeCents, m.expenseCents)))
	);
	const arrowText = $derived(direction === 'up' ? '↑ ' : direction === 'down' ? '↓ ' : '');

	/** Replaces the whole widget: nothing to show, or showing old data would mislead. */
	const problem = $derived(
		status === 'no-cache'
			? { icon: CloudOff, title: 'Can’t reach CentJar', body: 'Trying again soon.' }
			: status === 'token'
				? { icon: KeyRound, title: 'Widget needs a new token', body: 'Settings → Widget' }
				: null
	);
	/** Shown in place of "Updated …" when the numbers are the last saved ones. */
	const notice = $derived(
		status === 'offline'
			? { icon: WifiOff, text: `Offline · ${updated}` }
			: status === 'error'
				? { icon: TriangleAlert, text: `Couldn’t update · ${updated}` }
				: status === 'stale'
					? { icon: Clock, text: `Yesterday ${updated}` }
					: null
	);

	type Category = WidgetData['topCategories'][number];

	/** The bar under a category: budget used (red past the limit) or share of the month's spending. */
	function bar(c: Category) {
		if (detail === 'share')
			return {
				fill: c.shareOfSpending,
				over: false,
				label: `${Math.round(c.shareOfSpending * 100)}%`
			};
		if (c.limitCents === null || c.limitCents <= 0)
			return { fill: 0, over: false, label: 'No budget' };
		const used = c.spentCents / c.limitCents;
		return { fill: Math.min(used, 1), over: used > 1, label: `${Math.round(used * 100)}% used` };
	}

	function secondLine(c: Category) {
		if (detail === 'share') return `${Math.round(c.shareOfSpending * 100)}% of spending`;
		if (c.limitCents === null || c.leftCents === null) return 'No budget';
		if (c.leftCents >= 0) return `${roughMoney(c.leftCents)} left of ${roughMoney(c.limitCents)}`;
		return `${roughMoney(-c.leftCents)} over ${roughMoney(c.limitCents)}`;
	}

	const options = {
		scenario: [
			['spent', 'Spent more'],
			['earned', 'Earned more']
		],
		theme: [
			['dark', 'Dark'],
			['light', 'Light']
		],
		detail: [
			['budget', 'Budget'],
			['share', 'Share of spending']
		],
		layout: [
			['bars', 'Bars'],
			['list', 'List']
		]
	} as const;
</script>

<svelte:head><title>Widgets mock</title></svelte:head>

{#snippet segmented(
	label: string,
	choices: readonly (readonly [string, string])[],
	value: string,
	set: (v: string) => void
)}
	<div class="flex flex-col gap-1">
		<span class="text-xs font-medium text-gray-500">{label}</span>
		<div
			class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
			role="radiogroup"
			aria-label={label}
		>
			{#each choices as [key, text] (key)}
				<button
					type="button"
					role="radio"
					aria-checked={value === key}
					class={[
						'rounded-md px-3 py-1 text-sm',
						value === key
							? 'bg-white font-medium shadow-sm dark:bg-gray-950'
							: 'text-gray-600 dark:text-gray-400'
					]}
					onclick={() => set(key)}
				>
					{text}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet chip(c: Category, size: 'sm' | 'md')}
	{@const Icon = categoryIcon(c.icon)}
	<span
		class={[
			'flex shrink-0 items-center justify-center rounded-full bg-(--chip)',
			size === 'md' ? 'size-7' : 'size-5'
		]}
		aria-hidden="true"
	>
		<Icon class={size === 'md' ? 'size-4' : 'size-3'} />
	</span>
{/snippet}

<!-- "Updated 1:49 PM", or why the numbers are old ("Offline · 1:49 PM"). -->
{#snippet footer(short = false)}
	{#if notice}
		<div class="flex items-center gap-1 text-[10px] font-medium text-(--warn)">
			<notice.icon class="size-2.5 shrink-0" aria-hidden="true" />
			<span class="truncate">{notice.text}</span>
		</div>
	{:else}
		<div class="flex items-center gap-1 text-[10px] text-(--muted)">
			{#if !short}<Clock class="size-2.5" aria-hidden="true" />{/if}
			{short ? updated : `Updated ${updated}`}
		</div>
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

{#snippet arrow()}
	<span class="flex size-9 items-center justify-center rounded-full bg-(--accent) text-white">
		{#if direction === 'up'}
			<ArrowUp class="size-5" aria-label="Earned more than spent" />
		{:else if direction === 'down'}
			<ArrowDown class="size-5" aria-label="Spent more than earned" />
		{:else}
			<Minus class="size-5" aria-label="Even" />
		{/if}
	</span>
{/snippet}

<!-- Medium and large share a layout (the script draws large with the medium layout). -->
{#snippet topWide(size: 'medium' | 'large')}
	<!-- Top 3 (medium) or up to 7 (large). Order gives the rank; no medals. -->
	{@const shown = size === 'large' ? top7 : top3}
	<article class={['widget spend flex flex-col p-3.5', size]} aria-label="Top spending, {size}">
		{#if problem}
			{@render problemView('md')}
		{:else}
			<div class="mb-1 flex items-baseline gap-2 text-sm font-semibold">
				<span class="shrink-0"
					>Top spending <span class="font-normal text-(--muted)">· {monthShort}</span></span
				>
				<!-- The total the percentages are shares of, then when it was updated. -->
				<span class="figures ml-auto text-xs tabular-nums"
					>{money(widget.net.expenseCents)}<span class="ml-1 font-normal text-(--muted)">spent</span
					></span
				>
				{@render footer(true)}
			</div>
			{#if widget.topCategories.length === 0}
				<p class="flex flex-1 items-center justify-center text-xs text-(--muted)">
					No spending yet in {monthShort}
				</p>
			{:else}
				<ul
					class={[
						'figures flex flex-1 flex-col gap-2.5',
						shown.length === (size === 'large' ? 7 : 3) ? 'justify-around' : 'justify-start pt-2'
					]}
				>
					{#each shown as c (c.rank)}
						{@const b = bar(c)}
						<li class="flex items-center gap-2.5">
							{@render chip(c, 'md')}
							{#if layout === 'bars'}
								<div class="flex min-w-0 flex-1 flex-col gap-1">
									<div class="flex items-baseline gap-2">
										<span class="flex-1 truncate text-[13px] leading-tight font-medium"
											>{c.name}</span
										>
										<span class="text-[13px] leading-tight font-semibold tabular-nums">
											{money(c.spentCents)}
										</span>
									</div>
									<div class="flex items-center gap-2">
										<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-(--chip)">
											<div
												class="h-full rounded-full"
												style:width="{b.fill * 100}%"
												style:background={b.over ? 'var(--down)' : 'var(--bar)'}
											></div>
										</div>
										<span
											class={[
												'w-14 text-right text-[10px] leading-none tabular-nums',
												b.over ? 'text-(--down)' : 'text-(--muted)'
											]}>{b.label}</span
										>
									</div>
								</div>
							{:else}
								<div class="min-w-0 flex-1">
									<div class="truncate text-[13px] leading-tight font-medium">{c.name}</div>
									<div
										class={[
											'truncate text-[11px] leading-tight',
											b.over ? 'text-(--down)' : 'text-(--muted)'
										]}
									>
										{secondLine(c)}
									</div>
								</div>
								<span class="text-[13px] font-semibold tabular-nums">{money(c.spentCents)}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</article>
{/snippet}

{#snippet netWide(size: 'medium' | 'large')}
	<!-- Net, medium: the same plus where it came from -->
	<article
		class={['widget net flex flex-col justify-center p-3.5', size, problem ? 'flat' : direction]}
		aria-label="Net cash flow, {size}"
	>
		{#if problem}
			{@render problemView('md')}
		{:else}
			<div class="flex gap-4">
				<div class="flex h-32.5 w-[42%] flex-col">
					{@render arrow()}
					<div class="mt-auto text-xs font-semibold">Net cash flow</div>
					<div class="figures text-[30px] leading-none font-bold tracking-tight tabular-nums">
						{money(Math.abs(widget.net.netCents))}
					</div>
					<div class="mt-1 text-xs text-(--muted)">{widget.monthLabel}</div>
				</div>
				<div class="flex min-w-0 flex-1 flex-col justify-center gap-3">
					{#each [['Earned', widget.net.incomeCents, 'bar-in'], ['Spent', widget.net.expenseCents, 'bar-out']] as const as [label, cents, bar] (label)}
						<div class="figures flex flex-col gap-1">
							<div class="flex justify-between text-xs">
								<span class="text-(--muted)">{label}</span>
								<span class="font-semibold tabular-nums">{money(cents)}</span>
							</div>
							<div class="h-1.5 rounded-full bg-(--chip)">
								<div
									class={['h-full rounded-full', bar]}
									style:width="{(cents / max) * 100}%"
								></div>
							</div>
						</div>
					{/each}
					<div class="flex justify-end">{@render footer()}</div>
				</div>
			</div>
			{#if size === 'large'}
				<!-- Large only: the last 6 months, earned (green) beside spent (red); this month last. -->
				<div class="mt-4 flex flex-1 flex-col border-t border-(--chip) pt-3">
					<div class="mb-2 flex items-baseline justify-between text-xs">
						<span class="font-semibold">Last 6 months</span>
						<span class="flex items-center gap-2 text-[10px] text-(--muted)">
							<span class="flex items-center gap-1"
								><span class="bar-in size-1.5 rounded-full"></span>Earned</span
							>
							<span class="flex items-center gap-1"
								><span class="bar-out size-1.5 rounded-full"></span>Spent</span
							>
						</span>
					</div>
					<div class="figures flex flex-1 items-end justify-between gap-2">
						{#each widget.months as m, i (m.month)}
							{@const isNow = i === widget.months.length - 1}
							<div class="flex h-full flex-1 flex-col items-center justify-end gap-1">
								<div class="flex w-full flex-1 items-end justify-center gap-0.5">
									<div
										class="bar-in w-2.5 rounded-t"
										style:height="{(m.incomeCents / monthsMax) * 100}%"
									></div>
									<div
										class="bar-out w-2.5 rounded-t"
										style:height="{(m.expenseCents / monthsMax) * 100}%"
									></div>
								</div>
								<span class={['text-[10px]', isNow ? 'font-semibold' : 'text-(--muted)']}
									>{m.label}</span
								>
								<span
									class={[
										'text-[9px] tabular-nums',
										m.incomeCents >= m.expenseCents ? 'text-(--up)' : 'text-(--down)'
									]}
									>{m.incomeCents >= m.expenseCents ? '+' : '−'}{money(
										Math.abs(m.incomeCents - m.expenseCents)
									)}</span
								>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/if}
	</article>
{/snippet}

<main class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold">Widgets mock</h1>
		<p class="text-sm text-gray-500">
			Drawn the way the Scriptable scripts draw them, from a sample <code>/api/widget</code>
			response: small and medium (338×158) Home Screen widgets, then large and the Lock Screen.
		</p>
	</header>

	<div class="flex flex-wrap gap-4">
		<label class="flex flex-col gap-1">
			<span class="text-xs font-medium text-gray-500">State</span>
			<select
				bind:value={status}
				class="rounded-lg border-0 bg-gray-100 py-1 pr-8 pl-3 text-sm dark:bg-gray-800"
			>
				{#each STATUSES as [key, text] (key)}
					<option value={key}>{text}</option>
				{/each}
			</select>
		</label>
		{@render segmented(
			'Net this month',
			options.scenario,
			scenario,
			(v) => (scenario = v as typeof scenario)
		)}
		{@render segmented('Widget theme', options.theme, theme, (v) => (theme = v as typeof theme))}
		{@render segmented(
			'Bar / second line',
			options.detail,
			detail,
			(v) => (detail = v as typeof detail)
		)}
		{@render segmented(
			'Top spending layout',
			options.layout,
			layout,
			(v) => (layout = v as typeof layout)
		)}
	</div>

	<h2 class="text-sm font-medium text-gray-500">
		Budget (new, 2026-11-25): one ring for all budgets, then the top categories by spending
	</h2>
	<section
		class={['home flex flex-wrap content-start gap-5 rounded-3xl p-5', theme, notice && 'cached']}
		aria-label="Budget widgets preview"
	>
		<BudgetWidgets {widget} {monthShort} {updated} {problem} {notice} />
	</section>

	<h2 class="text-sm font-medium text-gray-500">Top spending and net cash flow (built)</h2>
	<!-- A stand-in for the Home Screen wallpaper. -->
	<section
		class={['home flex flex-wrap content-start gap-5 rounded-3xl p-5', theme, notice && 'cached']}
		aria-label="Home Screen preview"
	>
		{@render topWide('medium')}

		<!-- Top 3, small -->
		<article class="widget small spend flex flex-col p-3" aria-label="Top spending, small">
			{#if problem}
				{@render problemView('sm')}
			{:else}
				<div class="mb-1 text-xs font-semibold">
					Top spending <span class="font-normal text-(--muted)">· {monthShort}</span>
				</div>
				{#if widget.topCategories.length === 0}
					<p class="flex flex-1 items-center justify-center text-center text-xs text-(--muted)">
						No spending yet
					</p>
				{:else}
					<ul
						class={[
							'figures flex flex-1 flex-col gap-1.5',
							top3.length === 3 ? 'justify-around' : 'justify-start pt-1'
						]}
					>
						{#each top3 as c (c.rank)}
							<li class="flex items-center gap-1.5">
								{@render chip(c, 'sm')}
								<div class="min-w-0 flex-1">
									<div class="truncate text-[11px] leading-tight font-medium">{c.name}</div>
									<div class="text-[11px] leading-tight font-semibold tabular-nums">
										{money(c.spentCents)}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
				{@render footer()}
			{/if}
		</article>

		<!-- Net, small -->
		<article
			class={['widget small net flex flex-col p-3.5', problem ? 'flat' : direction]}
			aria-label="Net cash flow, small"
		>
			{#if problem}
				{@render problemView('sm')}
			{:else}
				<!-- Arrow on its own row; the title gets the full width (beside the arrow it was cut off). -->
				{@render arrow()}
				<div class="mt-auto truncate text-xs font-semibold">Net cash flow</div>
				<div class="figures text-[34px] leading-none font-bold tracking-tight tabular-nums">
					{money(Math.abs(widget.net.netCents))}
				</div>
				<div class="mt-1 text-xs text-(--muted)">{widget.monthLabel}</div>
				<div class="mt-1">{@render footer()}</div>
			{/if}
		</article>

		{@render netWide('medium')}
	</section>

	<h2 class="text-sm font-medium text-gray-500">
		Large (338×354): up to 7 categories; net cash flow adds the last 6 months
	</h2>
	<section
		class={['home flex flex-wrap content-start gap-5 rounded-3xl p-5', theme, notice && 'cached']}
		aria-label="Large widgets preview"
	>
		{@render topWide('large')}
		{@render netWide('large')}
	</section>

	<h2 class="text-sm font-medium text-gray-500">
		Lock Screen: plain text, tinted by iOS (shown in white on the wallpaper)
	</h2>
	<section
		class="lock flex flex-col gap-4 rounded-3xl p-5 text-white"
		aria-label="Lock Screen widgets preview"
	>
		<div class="flex flex-wrap items-center gap-6 text-sm font-medium">
			<span>
				{#if problem}CentJar: {problem.title}{:else}{arrowText}{money(
						Math.abs(widget.net.netCents)
					)} net · {monthShort}{/if}
			</span>
			<span>
				{#if problem}CentJar: {problem.title}{:else if widget.topCategories[0]}Top: {widget
						.topCategories[0].name}
					{money(widget.topCategories[0].spentCents)}{:else}No spending yet{/if}
			</span>
			<span class="text-xs text-white/60">← inline (above the clock)</span>
		</div>
		<div class="flex flex-wrap items-center gap-4">
			{#each ['net', 'top'] as const as which (which)}
				{@const Icon =
					problem?.icon ??
					(which === 'net'
						? direction === 'up'
							? ArrowUp
							: direction === 'down'
								? ArrowDown
								: Minus
						: categoryIcon(widget.topCategories[0]?.icon ?? 'shopping-cart'))}
				<div
					class="flex size-18 flex-col items-center justify-center gap-0.5 rounded-full bg-white/15"
					aria-label="{which === 'net' ? 'Net cash flow' : 'Top spending'}, circular"
				>
					<Icon class="size-4" aria-hidden="true" />
					<span class="text-xs font-bold tabular-nums">
						{problem
							? '!'
							: money(which === 'net' ? Math.abs(widget.net.netCents) : widget.net.expenseCents)}
					</span>
				</div>
			{/each}
			<div
				class="flex h-18 w-40 flex-col justify-center rounded-xl bg-white/15 px-2.5 leading-tight"
			>
				{#if problem}
					<span class="text-xs font-semibold">CentJar</span>
					<span class="truncate text-xs">{problem.title}</span>
				{:else}
					<span class="truncate text-xs font-semibold"
						>Net cash flow · {monthShort}{notice ? ' (old)' : ''}</span
					>
					<span class="truncate text-sm font-bold tabular-nums"
						>{arrowText}{money(Math.abs(widget.net.netCents))}</span
					>
					<span class="truncate text-xs"
						>Earned {money(widget.net.incomeCents)} · Spent {money(widget.net.expenseCents)}</span
					>
				{/if}
			</div>
			<div
				class="flex h-18 w-40 flex-col justify-center rounded-xl bg-white/15 px-2.5 leading-tight"
			>
				{#if problem}
					<span class="text-xs font-semibold">CentJar</span>
					<span class="truncate text-xs">{problem.title}</span>
				{:else}
					<span class="truncate text-xs font-semibold"
						>Top spending · {money(widget.net.expenseCents)}{notice ? ' (old)' : ''}</span
					>
					{#each top3 as c, i (c.rank)}
						<span class={['truncate', i === 0 ? 'text-sm font-bold' : 'text-xs']}
							>{c.name} {money(c.spentCents)}</span
						>
					{:else}
						<span class="text-xs">No spending yet in {monthShort}</span>
					{/each}
				{/if}
			</div>
			<span class="text-xs text-white/60">← circular and rectangular (below the clock)</span>
		</div>
	</section>

	<details class="text-sm">
		<summary class="cursor-pointer text-gray-500">Sample response</summary>
		<pre
			class="mt-2 overflow-x-auto rounded-lg bg-gray-100 p-3 text-xs dark:bg-gray-900">{JSON.stringify(
				widget,
				null,
				2
			)}</pre>
	</details>
</main>

<style>
	.home {
		--up: #16a34a;
		--down: #dc2626;
		--bar: #3b82f6;
		background: linear-gradient(135deg, #3b2f63, #1f3b57 55%, #23463d);
	}
	.home.light {
		--bg: #ffffff;
		--fg: #111827;
		--muted: #6b7280;
		--chip: #f3f4f6;
		--warn: #b45309;
		background: linear-gradient(135deg, #c7d2fe, #bae6fd 55%, #bbf7d0);
	}
	.home.dark {
		--bg: #1c1c1e;
		--fg: #f9fafb;
		--muted: #9ca3af;
		--chip: #2c2c2e;
		--warn: #fbbf24;
	}
	.widget {
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
	.lock {
		background: linear-gradient(160deg, #1e293b, #312e81 60%, #0f172a);
		font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
	}
	/* Last saved numbers: still readable, visibly not current. */
	.cached :global(.figures) {
		opacity: 0.6;
	}
	.net.up {
		--accent: var(--up);
	}
	.net.down {
		--accent: var(--down);
	}
	.net.flat {
		--accent: var(--muted);
	}
	.light .net.up {
		background: #ecfdf3;
	}
	.light .net.down {
		background: #fef2f2;
	}
	.dark .net.up {
		background: #12261b;
	}
	.dark .net.down {
		background: #2b1515;
	}
	/* Top spending: an indigo tint, so it reads as its own widget beside the net one. */
	.light .spend {
		background: #eef2ff;
		--chip: #dfe5fb;
	}
	.dark .spend {
		background: #181b30;
		--chip: #262a45;
	}

	.bar-in {
		background: var(--up);
	}
	.bar-out {
		background: var(--down);
	}
</style>
