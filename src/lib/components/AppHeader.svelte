<!--
	@component
	The top bar on every signed-in page, pinned while scrolling, so navigation sits in the same
	place everywhere:
	left = "← Home" (or the app name on the home page itself), right = the user menu.
	Page titles go in the page content below it.
-->
<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { resolve } from '$app/paths';
	import UserMenu from './UserMenu.svelte';

	let {
		name,
		home = false
	}: {
		/** Shown in the user menu. */
		name: string;
		/** True on the home page: shows the app name instead of a link back home. */
		home?: boolean;
	} = $props();
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
			<span class="px-2 text-sm font-semibold">Budget</span>
		{:else}
			<a
				href={resolve('/')}
				class="press flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
			>
				<ArrowLeft class="size-4" aria-hidden="true" />
				Home
			</a>
		{/if}
		<UserMenu {name} />
	</header>
</div>
