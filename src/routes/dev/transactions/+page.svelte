<script lang="ts">
	import TransactionList from '../../transactions/TransactionList.svelte';
	import TransactionTable from '../../transactions/TransactionTable.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Preview · Budget</title>
</svelte:head>

<main class="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:p-6">
	<p class="text-xs text-amber-700 dark:text-amber-400">
		Dev-only preview with made-up rows ({data.rows.length}). Add <code>?rows=500</code> for more.
	</p>
	<div class="sm:hidden"><TransactionList rows={data.rows} /></div>
	<div class="hidden sm:block"><TransactionTable rows={data.rows} /></div>
</main>
