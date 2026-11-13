<!--
	Mock: Settings navigation on phones once there are more sections than four tabs can hold.
	Three designs (pick at the top); wider screens keep today's sidebar in all of them.
	Frames are 375pt wide (iPhone SE/mini, the tightest).

	- List: a grouped list like the iPhone Settings app; a row opens the section full-screen and
	  the header's back link becomes "← Settings".
	- Switcher: no index page. The section title is a button ("Recurring ⌄") that drops down
	  every section with a one-line description; you switch in place.
	- Cards: /settings is a page of full and half width cards, each with a live summary
	  (budgeted this month, next recurring charge, …); a card opens the section like the list.
-->
<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleUser from '@lucide/svelte/icons/circle-user';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Tags from '@lucide/svelte/icons/tags';
	import Wallet from '@lucide/svelte/icons/wallet';

	type Row = {
		key: string;
		label: string;
		icon: typeof Wallet;
		/** Short status on the right, like iOS ("On", "4 active"). */
		hint: string;
		/** One line on what's inside (switcher design). */
		desc: string;
		/** Not built yet (from future plans). */
		later?: boolean;
		/** Icon tile colour (list design). */
		tint: string;
	};
	const groups: { label: string; rows: Row[] }[] = [
		{
			label: 'Money',
			rows: [
				{
					key: 'budgets',
					label: 'Budgets',
					icon: Wallet,
					hint: '8 set',
					desc: 'Monthly limits per category',
					tint: 'bg-emerald-500'
				},
				{
					key: 'recurring',
					label: 'Recurring',
					icon: Repeat,
					hint: '4 active',
					desc: 'Charges that repeat, and their reminders',
					tint: 'bg-sky-500'
				},
				{
					key: 'categories',
					label: 'Categories',
					icon: Tags,
					hint: '22',
					desc: 'Names, icons and order',
					tint: 'bg-amber-500'
				},
				{
					key: 'payment-methods',
					label: 'Payment methods',
					icon: CreditCard,
					hint: '3 cards',
					desc: 'Cards, cash and payment apps',
					tint: 'bg-violet-500',
					later: true
				}
			]
		},
		{
			label: 'This device',
			rows: [
				{
					key: 'notifications',
					label: 'Notifications',
					icon: Bell,
					hint: 'On',
					desc: 'Reminders on this phone',
					tint: 'bg-red-500'
				},
				{
					key: 'widget',
					label: 'Widget',
					icon: LayoutGrid,
					hint: '1 token',
					desc: 'Home Screen widget access',
					tint: 'bg-indigo-500',
					later: true
				}
			]
		}
	];
	const rows = groups.flatMap((g) => g.rows);

	type Design = 'list' | 'switcher' | 'cards';
	const DESIGNS: [Design, string][] = [
		['list', 'List (iOS-like)'],
		['switcher', 'Switcher'],
		['cards', 'Cards']
	];
	let design = $state<Design>('switcher');
	let showLater = $state(true);
	let open = $state('recurring');
	let switcherOpen = $state(false);
	const current = $derived(rows.find((r) => r.key === open) ?? rows[0]);
	const visibleGroups = $derived(
		groups.map((g) => ({ ...g, rows: g.rows.filter((r) => showLater || !r.later) }))
	);
	const visibleRows = $derived(visibleGroups.flatMap((g) => g.rows));
	const row = (key: string) => rows.find((r) => r.key === key)!;
</script>

<svelte:head><title>Settings navigation mock</title></svelte:head>

{#snippet header(back: string)}
	<div
		class="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white/90 px-4 dark:border-gray-800 dark:bg-gray-950/90"
	>
		<span class="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
			<ArrowLeft class="size-4" aria-hidden="true" />
			{back}
		</span>
		<CircleUser class="size-6 text-gray-500" aria-hidden="true" />
	</div>
{/snippet}

<!-- Stand-in for a section's real content. -->
{#snippet placeholder()}
	<div class="flex flex-col gap-3" aria-hidden="true">
		{#each [0, 1, 2] as i (i)}
			<div
				class="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
			>
				<div class="h-3 w-2/5 rounded bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-2.5 w-4/5 rounded bg-gray-100 dark:bg-gray-800"></div>
				<div class="h-2.5 w-3/5 rounded bg-gray-100 dark:bg-gray-800"></div>
			</div>
		{/each}
	</div>
{/snippet}

<!-- A section page opened from an index (list and cards designs). -->
{#snippet sectionPage()}
	<div class="phone">
		{@render header('Settings')}
		<div class="flex flex-col gap-4 px-4 pt-2 pb-6">
			<h2 class="text-2xl font-semibold">{current.label}</h2>
			{@render placeholder()}
		</div>
	</div>
{/snippet}

<!-- Switcher design: the section title is the menu button. -->
{#snippet switcherPage(menuOpen: boolean, toggle: () => void)}
	<div class="phone relative">
		{@render header('Home')}
		<div class="flex flex-col gap-4 px-4 pt-2 pb-6">
			<div class="flex flex-col">
				<span class="text-xs font-medium text-gray-500">Settings</span>
				<button
					type="button"
					onclick={toggle}
					aria-expanded={menuOpen}
					class="-ml-1 flex items-center gap-1.5 self-start rounded-md px-1 text-2xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					{current.label}
					<ChevronDown
						class={['size-5 text-gray-500 transition', menuOpen && 'rotate-180']}
						aria-hidden="true"
					/>
				</button>
			</div>
			<div class="relative">
				{@render placeholder()}
				{#if menuOpen}
					<!-- Drops down over the page, full width of the content. -->
					<div
						class="absolute inset-x-0 top-0 z-10 flex flex-col gap-1 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
					>
						{#each visibleGroups as g, gi (g.label)}
							{#if gi > 0}<div class="mx-2 my-0.5 h-px bg-gray-200 dark:bg-gray-800"></div>{/if}
							{#each g.rows as r (r.key)}
								<button
									type="button"
									onclick={() => {
										open = r.key;
										switcherOpen = false;
									}}
									class={[
										'flex items-center gap-3 rounded-lg px-2.5 py-2 text-left',
										open === r.key
											? 'bg-gray-100 dark:bg-gray-800'
											: 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
									]}
								>
									<r.icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="text-sm font-medium">{r.label}</span>
										<span class="truncate text-xs text-gray-500">{r.desc}</span>
									</span>
									{#if open === r.key}<Check class="size-4 shrink-0" aria-hidden="true" />{/if}
								</button>
							{/each}
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<!-- Cards design: one card. `wide` = full width. -->
{#snippet card(key: string, wide: boolean, body: import('svelte').Snippet)}
	{@const r = row(key)}
	<button
		type="button"
		onclick={() => (open = key)}
		class={[
			'flex flex-col gap-2 rounded-2xl border bg-white p-3.5 text-left dark:bg-gray-900',
			wide ? 'col-span-2' : '',
			open === key
				? 'border-gray-400 dark:border-gray-500'
				: 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
		]}
	>
		<!-- Half width: icon and › on top, title below, so long titles ("Payment methods") fit. -->
		<span class={['flex gap-2', wide ? 'items-center' : 'flex-col']}>
			<span class="flex items-center justify-between">
				<span
					class="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
				>
					<r.icon class="size-4" aria-hidden="true" />
				</span>
				{#if !wide}<ChevronRight class="size-4 shrink-0 text-gray-400" aria-hidden="true" />{/if}
			</span>
			<span class="flex-1 text-sm leading-tight font-semibold">{r.label}</span>
			{#if wide}<ChevronRight class="size-4 shrink-0 text-gray-400" aria-hidden="true" />{/if}
		</span>
		{@render body()}
	</button>
{/snippet}

{#snippet budgetsBody()}
	<span class="flex flex-col gap-1.5">
		<span class="flex items-baseline justify-between text-sm">
			<span><span class="font-semibold tabular-nums">$3,240</span> budgeted in Nov</span>
			<span class="text-xs text-gray-500">8 categories</span>
		</span>
		<span class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
			<span class="block h-full w-[62%] rounded-full bg-gray-900 dark:bg-gray-100"></span>
		</span>
		<span class="text-xs text-gray-500">62% spent · 17 days left</span>
	</span>
{/snippet}
{#snippet recurringBody()}
	<span class="flex flex-col gap-1 text-sm">
		<span><span class="font-semibold tabular-nums">$86.97</span> a month · 4 active</span>
		<span class="text-xs text-gray-500">Next: Netflix, $17.99 tomorrow</span>
	</span>
{/snippet}
{#snippet categoriesBody()}
	<span class="text-xs text-gray-500">18 expense<br />4 income</span>
{/snippet}
{#snippet paymentBody()}
	<span class="text-xs text-gray-500">3 cards, cash<br />Visa due Nov 28</span>
{/snippet}
{#snippet notificationsBody()}
	<span class="flex flex-col gap-1 text-xs text-gray-500">
		<span class="flex items-center gap-1.5">
			<span class="size-1.5 rounded-full bg-green-500"></span>On for this phone
		</span>
		<span>2 devices</span>
	</span>
{/snippet}
{#snippet widgetBody()}
	<span class="text-xs text-gray-500">1 token<br />Used 2 hours ago</span>
{/snippet}

<main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
	<header class="flex flex-col gap-3">
		<div class="flex flex-col gap-1">
			<h1 class="text-xl font-semibold">Settings navigation mock</h1>
			<p class="text-sm text-gray-500">
				Phones only (375pt frames). Wider screens keep the sidebar in every design.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-4">
			<div class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800" role="radiogroup">
				{#each DESIGNS as [key, text] (key)}
					<button
						type="button"
						role="radio"
						aria-checked={design === key}
						class={[
							'rounded-md px-3 py-1 text-sm',
							design === key
								? 'bg-white font-medium shadow-sm dark:bg-gray-950'
								: 'text-gray-600 dark:text-gray-400'
						]}
						onclick={() => (design = key)}
					>
						{text}
					</button>
				{/each}
			</div>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={showLater} class="rounded" />
				Include sections from future plans (Payment methods, Widget)
			</label>
		</div>
	</header>

	<div class="flex flex-wrap gap-6">
		{#if design === 'list'}
			<!-- 1. /settings as a grouped list -->
			<figure class="flex flex-col gap-2">
				<figcaption class="text-xs font-medium text-gray-500">/settings · tap a row</figcaption>
				<div class="phone">
					{@render header('Home')}
					<div class="flex flex-col gap-5 overflow-y-auto px-4 pt-2 pb-6">
						<h2 class="text-2xl font-semibold">Settings</h2>
						{#each visibleGroups as g (g.label)}
							<section class="flex flex-col gap-1.5">
								<h3 class="px-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
									{g.label}
								</h3>
								<ul
									class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900"
								>
									{#each g.rows as r (r.key)}
										<li>
											<button
												type="button"
												onclick={() => (open = r.key)}
												class={[
													'flex w-full items-center gap-3 px-3 py-2.5 text-left',
													open === r.key
														? 'bg-gray-100 dark:bg-gray-800'
														: 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
												]}
											>
												<span
													class={[
														'flex size-7 shrink-0 items-center justify-center rounded-md text-white',
														r.tint
													]}
												>
													<r.icon class="size-4" aria-hidden="true" />
												</span>
												<span class="flex-1 text-[15px]">{r.label}</span>
												<span class="text-sm text-gray-500">{r.hint}</span>
												<ChevronRight class="size-4 text-gray-400" aria-hidden="true" />
											</button>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				</div>
			</figure>
			<figure class="flex flex-col gap-2">
				<figcaption class="text-xs font-medium text-gray-500">/settings/{current.key}</figcaption>
				{@render sectionPage()}
			</figure>
		{:else if design === 'switcher'}
			<!-- 1. A section with the switcher closed (tap the title) -->
			<figure class="flex flex-col gap-2">
				<figcaption class="text-xs font-medium text-gray-500">
					/settings/{current.key} · tap the title
				</figcaption>
				{@render switcherPage(switcherOpen, () => (switcherOpen = !switcherOpen))}
			</figure>
			<!-- 2. Always open, for comparing -->
			<figure class="flex flex-col gap-2">
				<figcaption class="text-xs font-medium text-gray-500">Switcher open</figcaption>
				{@render switcherPage(true, () => {})}
			</figure>
		{:else}
			<!-- 1. /settings as cards -->
			<figure class="flex flex-col gap-2">
				<figcaption class="text-xs font-medium text-gray-500">/settings · tap a card</figcaption>
				<div class="phone">
					{@render header('Home')}
					<div class="flex flex-col gap-3 overflow-y-auto px-4 pt-2 pb-6">
						<h2 class="text-2xl font-semibold">Settings</h2>
						<div class="grid grid-cols-2 gap-2.5">
							{@render card('budgets', true, budgetsBody)}
							{@render card('recurring', true, recurringBody)}
							{@render card('categories', false, categoriesBody)}
							{#if showLater}{@render card('payment-methods', false, paymentBody)}{/if}
							{@render card('notifications', false, notificationsBody)}
							{#if showLater}{@render card('widget', false, widgetBody)}{/if}
						</div>
					</div>
				</div>
			</figure>
			<figure class="flex flex-col gap-2">
				<figcaption class="text-xs font-medium text-gray-500">/settings/{current.key}</figcaption>
				{@render sectionPage()}
			</figure>
		{/if}

		<!-- Today, for comparison -->
		<figure class="flex flex-col gap-2">
			<figcaption class="text-xs font-medium text-gray-500">
				Today's tabs, with {visibleRows.length} sections
			</figcaption>
			<div class="phone">
				{@render header('Home')}
				<div class="flex flex-col gap-4 px-4 pt-2 pb-6">
					<h2 class="text-2xl font-semibold">Settings</h2>
					<ul
						class="grid border-b border-gray-200 dark:border-gray-800"
						style:grid-template-columns="repeat({visibleRows.length}, minmax(0, 1fr))"
					>
						{#each visibleRows as r (r.key)}
							<li
								class={[
									'-mb-px flex flex-col items-center gap-1 border-b-2 px-1 py-2 text-xs font-medium',
									r.key === 'budgets'
										? 'border-gray-900 dark:border-white'
										: 'border-transparent text-gray-600 dark:text-gray-400'
								]}
							>
								<r.icon class="size-4" aria-hidden="true" />
								<span class="max-w-full overflow-hidden whitespace-nowrap">{r.label}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</figure>
	</div>
</main>

<style>
	.phone {
		width: 375px;
		height: 640px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 28px;
		border: 1px solid rgb(0 0 0 / 0.12);
		background: #f9fafb;
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
	}
	:global(.dark) .phone {
		background: #030712;
		border-color: rgb(255 255 255 / 0.12);
	}
</style>
