<script lang="ts">
	import './layout.css';
	import { asset } from '$app/paths';
	import { online } from 'svelte/reactivity/window';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
</svelte:head>

<!-- `online.current` is undefined during server rendering, so the banner only shows in the browser. -->
{#if online.current === false}
	<div
		class="fixed inset-x-0 top-0 z-50 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
		role="status"
	>
		You're offline. Showing the last saved version of this page.
	</div>
{/if}

{@render children()}
