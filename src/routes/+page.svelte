<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { clearPageCaches } from '#lib/offline.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Budget</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
	<h1 class="text-center text-3xl font-semibold">Welcome {data.username}</h1>

	<a
		href={resolve('/transactions')}
		class="rounded-md bg-gray-900 px-4 py-2 text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
	>
		View transactions
	</a>

	<form
		method="post"
		action="?/signOut"
		use:enhance={() =>
			async ({ update }) => {
				await clearPageCaches();
				await update();
			}}
	>
		<button
			class="rounded-md border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
		>
			Sign out
		</button>
	</form>
</main>
