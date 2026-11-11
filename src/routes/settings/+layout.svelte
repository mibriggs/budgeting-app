<!--
	Settings frame: the header, the "Settings" title and a sidebar of sections (a row of tabs on
	phones). Each section is its own route under /settings.
-->
<script lang="ts">
	import Tags from '@lucide/svelte/icons/tags';
	import Wallet from '@lucide/svelte/icons/wallet';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const sections = [
		{ href: resolve('/settings/categories'), label: 'Categories', icon: Tags },
		{ href: resolve('/settings/budgets'), label: 'Budgets', icon: Wallet }
	];
</script>

<AppHeader name={data.displayName} />

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<h1 class="text-2xl font-semibold">Settings</h1>

	<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
		<!-- Sidebar on wider screens (kept in view below the sticky header); tabs on phones. -->
		<nav aria-label="Settings" class="sm:sticky sm:top-18 sm:w-48 sm:shrink-0">
			<ul class="flex gap-1 border-b border-gray-200 sm:flex-col sm:border-0 dark:border-gray-800">
				{#each sections as s (s.href)}
					{@const active = page.url.pathname === s.href}
					<li>
						<a
							href={s.href}
							aria-current={active ? 'page' : undefined}
							class={[
								'press -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition sm:mb-0 sm:rounded-md sm:border-b-0',
								active
									? 'border-gray-900 text-gray-900 sm:bg-gray-100 dark:border-white dark:text-white dark:sm:bg-gray-800'
									: 'border-transparent text-gray-600 hover:text-gray-900 sm:hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-100 dark:sm:hover:bg-gray-900'
							]}
						>
							<s.icon class="size-4" aria-hidden="true" />
							{s.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<div class="min-w-0 flex-1">
			{@render children()}
		</div>
	</div>
</main>
