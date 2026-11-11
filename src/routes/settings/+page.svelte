<script lang="ts">
	import AppHeader from '#lib/components/AppHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Settings · Budget</title>
</svelte:head>

<AppHeader name={data.displayName} />

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<h1 class="text-2xl font-semibold">Settings</h1>
	<p
		class="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
	>
		Nothing here yet. Category and budget settings are coming.
	</p>
</main>
