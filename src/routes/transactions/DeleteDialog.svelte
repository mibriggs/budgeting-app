<!--
	@component
	Asks for confirmation, then deletes the given expenses or income rows through the page's
	`?/delete` form action. Nothing is deleted until "Delete" in the dialog is pressed.
-->
<script lang="ts">
	import { AlertDialog } from 'bits-ui';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { TransactionKind } from '#lib/server/budget/transactions.ts';

	let {
		open = $bindable(false),
		kind,
		ids,
		onDeleted
	}: {
		open?: boolean;
		kind: TransactionKind;
		/** Rows to delete, captured when the dialog opens. */
		ids: string[];
		/** Called after the server confirms, with how many rows were removed. */
		onDeleted: (count: number) => void;
	} = $props();

	let pending = $state(false);
	let cancelButton = $state<HTMLButtonElement | null>(null);
	let error = $state('');

	let noun = $derived(
		kind === 'expense'
			? ids.length === 1
				? 'expense'
				: 'expenses'
			: ids.length === 1
				? 'income entry'
				: 'income entries'
	);

	// Keep the current range and tab in the URL; `/delete` picks the form action.
	let action = $derived(`${page.url.search ? `${page.url.search}&` : '?'}/delete`);

	function onOpenChange(isOpen: boolean) {
		if (isOpen) error = '';
	}
</script>

<AlertDialog.Root bind:open {onOpenChange}>
	<AlertDialog.Portal>
		<AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<AlertDialog.Content
			onOpenAutoFocus={(event) => {
				// Start on Cancel so an accidental Enter doesn't delete anything.
				event.preventDefault();
				cancelButton?.focus();
			}}
			class="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-1/2 rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<form
				method="post"
				{action}
				use:enhance={() => {
					pending = true;
					error = '';
					return async ({ result, update }) => {
						pending = false;
						if (result.type === 'success') {
							open = false;
							onDeleted(Number(result.data?.deleted ?? 0));
							await update({ reset: false });
						} else if (result.type === 'failure') {
							error = String(result.data?.error ?? 'Could not delete. Please try again.');
						} else if (result.type === 'error') {
							error = navigator.onLine
								? 'Something went wrong. Please try again.'
								: "You're offline. Deleting needs a connection.";
						} else {
							await update();
						}
					};
				}}
			>
				<input type="hidden" name="kind" value={kind} />
				{#each ids as id (id)}
					<input type="hidden" name="id" value={id} />
				{/each}

				<AlertDialog.Title class="text-base font-semibold">
					Delete {ids.length === 1 ? 'this' : ids.length}
					{noun}?
				</AlertDialog.Title>
				<AlertDialog.Description class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					This permanently removes {ids.length === 1 ? 'it' : 'them'}. It can't be undone.
				</AlertDialog.Description>

				{#if error}
					<p class="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>
				{/if}

				<div class="mt-5 flex justify-end gap-2">
					<AlertDialog.Cancel
						bind:ref={cancelButton}
						type="button"
						class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
					>
						Cancel
					</AlertDialog.Cancel>
					<button
						type="submit"
						disabled={pending}
						class="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
					>
						{pending ? 'Deleting…' : 'Delete'}
					</button>
				</div>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Portal>
</AlertDialog.Root>
