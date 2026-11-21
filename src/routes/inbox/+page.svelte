<!--
	Quick-add inbox: where pasted or typed expenses saved for later will wait to be reviewed.
	Not built yet, so it says so. Reached from the user menu and the home page's Inbox card.
-->
<script lang="ts">
	import Inbox from '@lucide/svelte/icons/inbox';
	import { resolve } from '$app/paths';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Inbox · CentJar</title>
</svelte:head>

<AppHeader name={data.displayName} />

<main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-2 pb-6 sm:px-6">
	<h1 class="text-2xl font-semibold">Inbox</h1>

	<section
		class="mx-auto flex w-full max-w-md flex-col items-center gap-2 rounded-lg border border-gray-200 px-6 py-12 text-center dark:border-gray-800"
	>
		<span class="grid size-10 place-items-center rounded-full bg-gray-100 dark:bg-gray-800">
			<Inbox class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
		</span>
		<p class="text-sm font-medium">Coming soon</p>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Paste a bank alert or type a quick note like "5.06 apple card snacks", and it waits here until
			you add it.
		</p>
		<a
			href={resolve('/')}
			class="mt-2 text-sm text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
		>
			Back to Home
		</a>
	</section>
</main>
