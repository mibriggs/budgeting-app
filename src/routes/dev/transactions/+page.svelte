<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { createMediaQuery, WIDE_SCREEN } from '#lib/media.svelte.ts';
	import AddTransactionDialog from '#lib/components/AddTransactionDialog.svelte';
	import DeleteDialog from '../../transactions/DeleteDialog.svelte';
	import RangePicker from '../../transactions/RangePicker.svelte';
	import TransactionGrid from '../../transactions/TransactionGrid.svelte';
	import TransactionList from '../../transactions/TransactionList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const wide = createMediaQuery(WIDE_SCREEN);
	const selected = new SvelteSet<string>();
	let selecting = $state(false);

	// The preview has no delete action, so confirming here shows an error instead of deleting.
	let dialogOpen = $state(false);
	let dialogIds = $state<string[]>([]);
	let addOpen = $state(false);
	function confirmDelete(ids: string[]) {
		dialogIds = ids;
		dialogOpen = true;
	}
</script>

<svelte:head>
	<title>Preview · Budget</title>
</svelte:head>

<main class="mx-auto flex max-w-6xl flex-col gap-4 p-4 sm:h-dvh sm:p-6">
	<p class="text-xs text-amber-700 dark:text-amber-400">
		Dev-only preview with made-up rows ({data.rows.length}). Add <code>?rows=5000</code> for more. Deleting
		here is not wired up.
	</p>
	<div class="flex items-center gap-2 text-sm">
		<button
			type="button"
			class="rounded-md border px-3 py-1"
			onclick={() => (selecting = !selecting)}
		>
			{selecting ? 'Done' : 'Select'}
		</button>
		<span>{selected.size} selected</span>
		<button
			type="button"
			class="rounded-md bg-red-600 px-3 py-1 text-white disabled:opacity-50"
			disabled={selected.size === 0}
			onclick={() => confirmDelete([...selected])}
		>
			Delete
		</button>
		<button type="button" class="rounded-md border px-3 py-1" onclick={() => (addOpen = true)}>
			Add (preview)
		</button>
	</div>
	<RangePicker range={data.range} />
	<div class="sm:hidden">
		<TransactionList
			rows={data.rows}
			{selected}
			{selecting}
			onDelete={confirmDelete}
			active={wide.current !== true}
		/>
	</div>
	<div class="hidden min-h-0 flex-1 sm:block">
		<TransactionGrid rows={data.rows} label="Preview" {selected} active={wide.current !== false} />
	</div>
</main>

<DeleteDialog bind:open={dialogOpen} kind="expense" ids={dialogIds} onDeleted={() => {}} />

<!-- Saving fails here (no create action on this page); it's for checking the dialog itself. -->
<AddTransactionDialog
	bind:open={addOpen}
	kind="expense"
	categories={data.categories}
	today={data.today}
	onCreated={() => {}}
/>
