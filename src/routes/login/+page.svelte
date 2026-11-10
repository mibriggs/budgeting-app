<script lang="ts">
	import GithubLogo from '#lib/components/GithubLogo.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in · Budget</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6">
	<h1 class="text-3xl font-semibold">Sign in</h1>

	<!-- No use:enhance: the action redirects to github.com, which needs a full page navigation. -->
	<form method="post" action="?/signInWithGitHub">
		<button
			class="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
		>
			<GithubLogo />
			Sign in with GitHub
		</button>
	</form>

	{#if form?.message}
		<p class="text-sm text-red-600" role="alert">{form.message}</p>
	{/if}
</main>
