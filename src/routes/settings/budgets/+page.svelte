<!--
	Settings → Budgets: a monthly limit per expense category. Edits are drafts: changed rows are
	highlighted, and nothing is stored until Save (in the bar that appears at the bottom).
	Saving sets the limits from this month on; earlier months keep theirs.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { limitField, parseLimit } from '#lib/budget-input.ts';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatMonth } from '#lib/date-range.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// "1,800" or "12.5": how a stored limit appears in its box.
	const plain = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	});
	const toInput = (cents: number | null) => (cents === null ? '' : plain.format(cents / 100));

	// What's stored (from the server) and what's typed. Drafts reset whenever the stored values
	// change, i.e. on load and after a save.
	let saved = $derived(Object.fromEntries(data.budgets.map((b) => [b.id, b.limitCents])));
	// svelte-ignore state_referenced_locally
	let drafts = $state<Record<string, string>>(
		Object.fromEntries(data.budgets.map((b) => [b.id, toInput(b.limitCents)]))
	);
	let saving = $state(false);
	// Per-category errors from the save action (normally the page catches bad input first).
	let serverErrors = $state<Record<string, string>>({});

	$effect.pre(() => {
		const rows = data.budgets;
		untrack(() => {
			drafts = Object.fromEntries(rows.map((b) => [b.id, toInput(b.limitCents)]));
			serverErrors = {};
		});
	});

	let parsed = $derived(
		Object.fromEntries(Object.entries(drafts).map(([id, text]) => [id, parseLimit(text)]))
	);
	let changed = $derived(Object.keys(parsed).filter((id) => parsed[id] !== saved[id]));
	let invalidCount = $derived(Object.values(parsed).filter((v) => v === 'invalid').length);

	// The header shows what the budget will be once saved.
	let total = $derived(
		Object.values(parsed).reduce<number>((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
	);
	let withLimit = $derived(Object.values(parsed).filter((v) => typeof v === 'number').length);
	let monthLabel = $derived(formatMonth(data.month));

	const describe = (cents: number | null) => (cents === null ? 'no limit' : formatCents(cents));

	function discard() {
		drafts = Object.fromEntries(data.budgets.map((b) => [b.id, toInput(b.limitCents)]));
		serverErrors = {};
	}

	// Leaving with unsaved changes asks first (the browser asks on reload or closing the tab).
	beforeNavigate((navigation) => {
		if (changed.length === 0 || saving) return;
		if (navigation.type === 'leave') navigation.cancel();
		else if (!confirm('Discard your unsaved budget changes?')) navigation.cancel();
	});
</script>

<svelte:head>
	<title>Budgets · Settings · Budget</title>
</svelte:head>

<section aria-labelledby="section-title">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div>
			<h2 id="section-title" class="text-lg font-semibold">Budgets</h2>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Set how much you want to spend in each category per month. Changes start in {monthLabel};
				past months aren’t affected.
			</p>
		</div>
		<p class="text-sm tabular-nums">
			<span class="text-gray-500 dark:text-gray-400">Total budget:</span>
			<span class="font-semibold">{formatCentsWhole(total)}</span>
			<span class="text-gray-500 dark:text-gray-400">
				a month · {withLimit} of {data.budgets.length} categories {withLimit === 1 ? 'has' : 'have'} a
				limit
			</span>
		</p>
	</div>

	{#if data.budgets.length === 0}
		<p
			class="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
		>
			No expense categories yet.
		</p>
	{:else}
		<!-- One form, so Enter in any box saves too. -->
		<form
			method="post"
			class="mt-4"
			use:enhance={({ cancel }) => {
				if (changed.length === 0 || invalidCount > 0) return cancel();
				saving = true;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'success') {
						const count = Number(result.data?.saved ?? 0);
						toast.success(`Saved ${count} budget ${count === 1 ? 'change' : 'changes'}.`, {
							description: `From ${monthLabel} on.`
						});
						await update({ reset: false });
					} else if (result.type === 'failure') {
						serverErrors = (result.data?.errors as Record<string, string>) ?? {};
					} else if (result.type === 'error') {
						toast.error(
							navigator.onLine
								? 'Couldn’t save your budgets. Please try again.'
								: 'You’re offline. Saving needs a connection.'
						);
					} else {
						await update();
					}
				};
			}}
		>
			<ul
				class="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
			>
				{#each data.budgets as category (category.id)}
					{@const Icon = categoryIcon(category.icon)}
					{@const inputId = `limit-${category.id}`}
					{@const isChanged = changed.includes(category.id)}
					{@const error =
						parsed[category.id] === 'invalid'
							? 'Enter an amount like 600 or 12.50.'
							: serverErrors[category.id]}
					<!-- Changed rows are tinted amber until saved or discarded. -->
					<li
						class={[
							'flex items-center gap-3 px-3 py-2 transition-colors',
							isChanged && !error && 'bg-amber-100/70 dark:bg-amber-400/10'
						]}
					>
						<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
						<div class="flex min-w-0 flex-1 flex-col">
							<label for={inputId} class="truncate text-sm">{category.name}</label>
							{#if error}
								<span id="{inputId}-note" class="text-xs text-red-700 dark:text-red-400">
									{error}
								</span>
							{:else if isChanged}
								<!-- What it was, so a change can be checked before saving. -->
								<span
									id="{inputId}-note"
									class="text-xs text-amber-800 tabular-nums dark:text-amber-300"
								>
									Was {describe(saved[category.id])}
								</span>
							{/if}
						</div>
						<div class="relative w-32 shrink-0">
							{#if drafts[category.id]}
								<span
									class="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-gray-500"
									aria-hidden="true">$</span
								>
							{/if}
							<input
								id={inputId}
								name={limitField(category.id)}
								bind:value={drafts[category.id]}
								oninput={() => delete serverErrors[category.id]}
								inputmode="decimal"
								autocomplete="off"
								placeholder="No limit"
								aria-invalid={error ? true : undefined}
								aria-describedby={error || isChanged ? `${inputId}-note` : undefined}
								onkeydown={(event) => {
									// Escape puts just this box back.
									if (event.key === 'Escape') drafts[category.id] = toInput(saved[category.id]);
								}}
								class={[
									'w-full rounded-md bg-white py-1.5 pr-2.5 pl-6 text-right text-sm tabular-nums placeholder:text-gray-400 aria-invalid:border-red-500 dark:bg-gray-900',
									isChanged && !error
										? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-400 dark:focus:border-amber-400 dark:focus:ring-amber-400'
										: 'border-gray-300 focus:border-gray-500 focus:ring-gray-500 dark:border-gray-700'
								]}
							/>
						</div>
					</li>
				{/each}
			</ul>
			<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Leave a box empty for no limit. Escape undoes a box.
			</p>

			<!-- Appears once something changes; sticks to the bottom of the screen while scrolling. -->
			{#if changed.length > 0}
				<div
					transition:fly={{ y: 16, duration: prefersReducedMotion.current ? 0 : 200 }}
					class="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
					role="region"
					aria-label="Unsaved changes"
				>
					<p class="text-sm" aria-live="polite">
						{#if invalidCount > 0}
							<span class="text-red-700 dark:text-red-400">
								Fix {invalidCount === 1 ? '1 amount' : `${invalidCount} amounts`} to save.
							</span>
						{:else}
							{changed.length} unsaved {changed.length === 1 ? 'change' : 'changes'}
						{/if}
					</p>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={discard}
							disabled={saving}
							class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
						>
							Discard
						</button>
						<button
							type="submit"
							disabled={saving || invalidCount > 0}
							class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{saving ? 'Saving…' : 'Save'}
						</button>
					</div>
				</div>
			{/if}
		</form>
	{/if}
</section>
