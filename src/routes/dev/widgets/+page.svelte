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

	let { data }: PageProps = $props();

	let scenario = $state<'earned' | 'spent'>('spent');
	let theme = $state<'dark' | 'light'>('dark');
	let detail = $state<'budget' | 'share'>('share');
	let layout = $state<'bars' | 'list'>('bars');

	type Status = 'live' | 'offline' | 'error' | 'stale' | 'no-cache' | 'token' | 'empty' | 'few';
	let status = $state<Status>('live');
	const STATUSES: [Status, string][] = [
		['live', 'Up to date'],
		['offline', 'Offline, showing last data'],
		['error', 'Server error or bad response, showing last data'],
		['stale', 'Last data is from yesterday'],
		['no-cache', 'Offline, nothing saved yet'],
		['token', 'Token revoked or wrong'],
		['empty', 'New month, nothing spent yet'],
		['few', 'Only one category so far']
	];

	const base: WidgetData = $derived(scenario === 'earned' ? data.earnedMore : data.spentMore);
	const widget: WidgetData = $derived.by(() => {
		if (status === 'empty')
			return {
				...base,
				month: '2026-12',
				monthLabel: 'Dec 2026',
				topCategories: [],
				net: { incomeCents: 0, expenseCents: 0, netCents: 0 }
			};
		if (status === 'few')
			return {
				...base,
				topCategories: base.topCategories
					.slice(1, 2)
					.map((c) => ({ ...c, rank: 1, shareOfSpending: 1 }))
			};
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

<main class="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold">Widgets mock</h1>
		<p class="text-sm text-gray-500">
			Small (158×158) and medium (338×158) iPhone widgets. Drawn from the planned
			<code>/api/widget</code> response; the real ones will be a Scriptable script.
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

	<!-- A stand-in for the Home Screen wallpaper. -->
	<section
		class={['home flex flex-wrap content-start gap-5 rounded-3xl p-5', theme, notice && 'cached']}
		aria-label="Home Screen preview"
	>
		<!-- Top 3, medium. Order gives the rank; no medals. -->
		<article class="widget medium spend flex flex-col p-3.5" aria-label="Top spending, medium">
			{#if problem}
				{@render problemView('md')}
			{:else}
				<div class="mb-1 flex items-baseline justify-between gap-2 text-sm font-semibold">
					<span class="shrink-0"
						>Top spending <span class="font-normal text-(--muted)">· {monthShort}</span></span
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
							widget.topCategories.length === 3 ? 'justify-around' : 'justify-start pt-2'
						]}
					>
						{#each widget.topCategories as c (c.rank)}
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
							widget.topCategories.length === 3 ? 'justify-around' : 'justify-start pt-1'
						]}
					>
						{#each widget.topCategories as c (c.rank)}
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
				<div class="flex items-start justify-between gap-2">
					{@render arrow()}
					<span class="text-right text-xs leading-tight font-semibold">Net cash<br />flow</span>
				</div>
				<div class="figures mt-auto text-[34px] leading-none font-bold tracking-tight tabular-nums">
					{money(Math.abs(widget.net.netCents))}
				</div>
				<div class="mt-1 text-xs text-(--muted)">{widget.monthLabel}</div>
				<div class="mt-1">{@render footer()}</div>
			{/if}
		</article>

		<!-- Net, medium: the same plus where it came from -->
		<article
			class={['widget medium net flex gap-4 p-3.5', problem ? 'flat' : direction]}
			aria-label="Net cash flow, medium"
		>
			{#if problem}
				{@render problemView('md')}
			{:else}
				<div class="flex w-[42%] flex-col">
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
			{/if}
		</article>
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
