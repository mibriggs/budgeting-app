<!--
	Settings frame. Below `large` (an 11-inch iPad in landscape): /settings is an overview of
	cards, one per section, and a section shows on its own with "← Settings" in the header. At
	`large` and up there are no cards: a section shows beside a sidebar of sections, and
	/settings goes straight to Budgets.
-->
<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Tags from '@lucide/svelte/icons/tags';
	import Wallet from '@lucide/svelte/icons/wallet';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import { createMediaQuery, LARGE_SCREEN } from '#lib/media.svelte.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const sections = [
		{ id: '/settings/budgets', href: resolve('/settings/budgets'), label: 'Budgets', icon: Wallet },
		{
			id: '/settings/recurring',
			href: resolve('/settings/recurring'),
			label: 'Recurring',
			icon: Repeat
		},
		{
			id: '/settings/categories',
			href: resolve('/settings/categories'),
			label: 'Categories',
			icon: Tags
		},
		{
			id: '/settings/notifications',
			href: resolve('/settings/notifications'),
			label: 'Notifications',
			icon: Bell
		},
		{
			id: '/settings/widget',
			href: resolve('/settings/widget'),
			label: 'Widget',
			icon: LayoutGrid
		}
	];
	// Not built yet: listed, muted, not links (same as the "Coming soon" cards).
	const comingSoon = [{ label: 'Payment methods', icon: CreditCard }];
	// Compared by route id: during server rendering resolve() gives relative paths ("./settings"),
	// which never equal the URL's pathname.
	const onOverview = $derived(page.route.id === '/settings');

	// No overview on large screens. The server can't know the screen size, so the cards are
	// hidden there by CSS and the page moves on to Budgets once the browser knows (the user
	// menu links straight to Budgets on large screens, so this is only for typed or old links).
	const large = createMediaQuery(LARGE_SCREEN);
	$effect(() => {
		if (onOverview && large.current) goto(resolve('/settings/budgets'), { replaceState: true });
	});
</script>

<AppHeader name={data.displayName} back={onOverview ? 'home' : 'settings'} />

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<!-- On a section below `large`, only the section's own title shows (the header says
	     "← Settings"). -->
	<h1 class={['text-2xl font-semibold', !onOverview && 'hidden large:block']}>Settings</h1>

	{#if onOverview}
		<div class="large:hidden">
			{@render children()}
		</div>
	{:else}
		<div class="flex flex-col gap-6 large:flex-row large:items-start">
			<!-- Sidebar on large screens, kept in view below the sticky header. -->
			<nav
				aria-label="Settings"
				class="hidden large:sticky large:top-18 large:block large:w-56 large:shrink-0"
			>
				<ul class="flex flex-col gap-1">
					{#each sections as s (s.href)}
						{@const active = page.route.id === s.id}
						<li>
							<a
								href={s.href}
								aria-current={active ? 'page' : undefined}
								class={[
									'press flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
									active
										? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
										: 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
								]}
							>
								<s.icon class="size-4" aria-hidden="true" />
								{s.label}
							</a>
						</li>
					{/each}
					{#each comingSoon as s (s.label)}
						<li
							class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-400 dark:text-gray-500"
						>
							<s.icon class="size-4" aria-hidden="true" />
							<span class="flex-1">{s.label}</span>
							<span
								class="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
							>
								Soon
							</span>
						</li>
					{/each}
				</ul>
			</nav>

			<div class="min-w-0 flex-1">
				{@render children()}
			</div>
		</div>
	{/if}
</main>
