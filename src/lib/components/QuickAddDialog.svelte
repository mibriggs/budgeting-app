<!--
	@component
	Quick add: paste a bank alert or type a shorthand ("5.06 apple card snacks") and Send. The sheet
	closes straight away; the message goes to the inbox, where the server reads it (the patterns,
	then Claude when they can't fill in everything). A toast says when it's ready to review, or a
	push if the app was closed in the meantime (see #lib/quick-add/client.ts).

	Opens empty with the box focused. Reading the clipboard straight away would make Safari show its
	own "Paste" bubble first, so it's only filled in when the browser allows reading without asking
	(Chrome, once the site is allowed); "Paste from clipboard" asks outright when the user taps it.
-->
<script lang="ts">
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import { Dialog } from 'bits-ui';
	import { sendQuickAdd } from '#lib/quick-add/client.ts';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let text = $state('');
	let problem = $state<string | null>(null);

	// Each time it opens: start empty, then fill in the clipboard if it can be read silently.
	$effect(() => {
		if (!open) return;
		text = '';
		problem = null;
		clipboardIfAllowed().then((clip) => {
			if (clip && open && !text) text = clip;
		});
	});

	/** The clipboard, only if reading it won't prompt; '' otherwise (always in Safari). */
	async function clipboardIfAllowed(): Promise<string> {
		try {
			const permission = await navigator.permissions?.query({
				name: 'clipboard-read' as PermissionName
			});
			if (permission?.state !== 'granted') return '';
			return (await navigator.clipboard.readText()).trim();
		} catch {
			return '';
		}
	}

	async function pasteFromClipboard() {
		try {
			const clip = (await navigator.clipboard.readText()).trim();
			if (clip) text = clip;
			else problem = 'The clipboard is empty.';
		} catch {
			problem = "Couldn't read the clipboard. Paste into the box instead.";
		}
	}

	function send(event: SubmitEvent) {
		event.preventDefault();
		const message = text.trim();
		if (!message) return;
		open = false;
		// Not awaited: it reports back with toasts after the sheet has closed.
		sendQuickAdd(message);
	}

	const secondary =
		'rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<form class="flex flex-col gap-4" onsubmit={send}>
				<div>
					<Dialog.Title class="text-base font-semibold">Quick add</Dialog.Title>
					<Dialog.Description class="text-xs text-gray-500 dark:text-gray-400">
						A bank alert, or a shorthand like "5.06 apple card snacks". It goes to your inbox to
						review.
					</Dialog.Description>
				</div>

				<div class="flex flex-col gap-1.5">
					<textarea
						bind:value={text}
						rows="3"
						aria-label="Message"
						placeholder="Paste or type here"
						maxlength="2000"
						class="w-full resize-y rounded-md border-gray-300 text-sm dark:border-gray-700 dark:bg-gray-900"
						oninput={() => (problem = null)}
						onkeydown={(e) => {
							// Enter sends; Shift+Enter makes a new line.
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								e.currentTarget.form?.requestSubmit();
							}
						}}></textarea>
					{#if !text.trim()}
						<button
							type="button"
							class="flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
							onclick={pasteFromClipboard}
						>
							<ClipboardPaste class="size-3.5" aria-hidden="true" /> Paste from clipboard
						</button>
					{/if}
					{#if problem}
						<p class="text-xs text-gray-600 dark:text-gray-400" role="status">{problem}</p>
					{/if}
				</div>

				<div class="flex justify-end gap-2">
					<Dialog.Close type="button" class={secondary}>Cancel</Dialog.Close>
					<button
						type="submit"
						disabled={!text.trim()}
						class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						Send
					</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
