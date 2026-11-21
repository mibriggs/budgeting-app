<!--
	@component
	The top bar on every signed-in page, pinned while scrolling, so navigation sits in the same
	place everywhere:
	left = "← Home" (or the app name on the home page itself), right = the user menu.
	Settings sections below `large` show a breadcrumb instead, "Home › Settings", so a phone can
	go straight home from e.g. Settings → Recurring (the section's title is just below).
	Page titles go in the page content below it.
-->
<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import UserMenu from './UserMenu.svelte';

	let {
		name,
		home = false,
		back = 'home',
		inboxCount = 0
	}: {
		/** Shown in the user menu. */
		name: string;
		/** True on the home page: shows the app name instead of a link back home. */
		home?: boolean;
		/** Where the back link goes (default: Home). Settings sections use "settings": a
		 *  "Home › Settings" breadcrumb below `large`, "← Home" from `large` up. */
		back?: 'home' | 'settings';
		/** Quick-add items waiting, shown in the user menu (see UserMenu). */
		inboxCount?: number;
	} = $props();

	const backClass =
		'press flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800';
	const crumbClass =
		'press rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800';
</script>

<!-- Pinned to the top while the page scrolls (56px tall: anything else sticky goes below it at
     top-14). The wrapper spans the full width so its background covers the whole top edge. -->
<div
	class="sticky top-0 z-40 shrink-0 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90"
>
	<!-- Same max width and side padding as page content (max-w-6xl, px-4/sm:px-6), so the header's
	     edges line up with titles and buttons below at any window size. -->
	<header
		class="mx-auto flex h-14 w-full max-w-6xl shrink-0 items-center justify-between gap-4 px-4 sm:px-6"
	>
		{#if home}
			<span class="flex items-center gap-2 px-2 text-sm font-semibold">
				<img src="/favicon.svg" alt="" class="size-6" />
				CentJar
			</span>
		{:else if back === 'settings'}
			<!-- Settings sections below `large`: a breadcrumb, so both the Settings cards and Home are
			     one tap away. From `large` up there are no cards (a sidebar instead), so just home. -->
			<nav aria-label="Breadcrumb" class="shrink-0 large:hidden">
				<ol class="flex items-center">
					<li>
						<a href={resolve('/')} class={crumbClass}>Home</a>
					</li>
					<li class="flex items-center">
						<ChevronRight class="size-3.5 text-gray-400" aria-hidden="true" />
						<a href={resolve('/settings')} class={crumbClass}>Settings</a>
					</li>
				</ol>
			</nav>
			<a href={resolve('/')} class="{backClass} hidden large:flex">
				<ArrowLeft class="size-4" aria-hidden="true" />
				Home
			</a>
		{:else}
			<a href={resolve('/')} class={backClass}>
				<ArrowLeft class="size-4" aria-hidden="true" />
				Home
			</a>
		{/if}
		<UserMenu {name} {inboxCount} />
	</header>
</div>
