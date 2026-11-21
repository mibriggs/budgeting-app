<!--
	@component
	One inbox item: what Quick add read from a pasted alert or typed note, ready to check and add.
	The suggested card and category start selected (pills); change either (and the details) as
	needed, then Add expense, at the end of the action row, saves it (?/add, checked like the Add form). Nothing is saved before that.
	Dismiss removes it without adding anything.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import FileQuestion from '@lucide/svelte/icons/file-question';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatDate } from '#lib/date-range.ts';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatCents } from '#lib/money.ts';
	import { last4Label, type PaymentMethodOption } from '#lib/payment-methods.ts';
	import { parseAmount, parseDate } from '#lib/transaction-input.ts';

	type Item = {
		id: string;
		message: string;
		status: 'reading' | 'ready' | 'failed';
		readBy: 'parser' | 'claude' | null;
		isExpense: boolean;
		name: string | null;
		amountCents: number | null;
		purchaseDate: PlainDate | null;
		paymentMethodId: string | null;
		categoryId: string | null;
		note: string | null;
	};

	let {
		item,
		categories,
		paymentMethods,
		today
	}: {
		item: Item;
		categories: { id: string; name: string; icon: string | null }[];
		paymentMethods: PaymentMethodOption[];
		today: PlainDate;
	} = $props();

	// The card's own editable copy of the item. Nothing is saved until Add expense.
	// svelte-ignore state_referenced_locally
	let fields = $state({
		name: item.name ?? '',
		amount: item.amountCents ? (item.amountCents / 100).toFixed(2) : '',
		date: (item.purchaseDate ?? today).toString(),
		paymentMethodId: item.paymentMethodId ?? '',
		// The suggestion, if it's still one of the user's categories.
		categoryId: categories.some((c) => c.id === item.categoryId) ? (item.categoryId ?? '') : ''
	});
	// svelte-ignore state_referenced_locally
	let isExpense = $state(item.isExpense);
	// Open the details when something needed is missing.
	// svelte-ignore state_referenced_locally
	let editing = $state(item.status === 'failed' || !item.name || !item.amountCents);
	// svelte-ignore state_referenced_locally
	let showMessage = $state(item.status === 'failed');
	let busy = $state(false);
	let problem = $state<string | null>(null);

	const method = $derived(paymentMethods.find((m) => m.id === fields.paymentMethodId));
	const amountCents = $derived(parseAmount(fields.amount));
	/** Categories with the suggested one first. */
	const ordered = $derived.by(() => {
		const first = categories.find((c) => c.id === item.categoryId);
		return first ? [first, ...categories.filter((c) => c !== first)] : categories;
	});
	let showAllCategories = $state(false);
	const shownCategories = $derived(
		showAllCategories
			? ordered
			: // Keep a category picked from "More" in view after it's collapsed.
				ordered.filter((c, i) => i < 4 || c.id === fields.categoryId)
	);
	const selectedCategory = $derived(categories.find((c) => c.id === fields.categoryId));
	const Icon = $derived(
		item.status === 'failed' ? FileQuestion : categoryIcon(selectedCategory?.icon)
	);

	function when(text: string): string {
		const d = parseDate(text);
		if (!d) return text;
		const days = d.until(today).days;
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
	}

	const small =
		'flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800';
	// The Add dialog's field style (AddTransactionDialog.svelte), for Edit details.
	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-xs font-medium';
	const chip = 'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition';
	const chipOff = 'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
	const chipOn =
		'border-transparent bg-gray-900 font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
</script>

<li class="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
	{#if item.status === 'reading'}
		<div class="flex items-start gap-3">
			<span
				class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
			>
				<LoaderCircle class="size-4 animate-spin text-gray-500" aria-hidden="true" />
			</span>
			<div class="flex min-w-0 flex-1 flex-col">
				<span class="text-sm font-medium">Reading…</span>
				<span class="truncate text-xs text-gray-500 dark:text-gray-400">{item.message}</span>
			</div>
		</div>
	{:else}
		<!-- What it read -->
		<div class="flex items-start gap-3">
			<span
				class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
			>
				<Icon class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
			</span>
			<div class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-sm font-medium">
					{fields.name || (item.status === 'failed' ? 'Couldn’t read this' : 'No name yet')}
				</span>
				<span
					class="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-gray-500 dark:text-gray-400"
				>
					<span>{when(fields.date)}</span>
					{#if method}
						<span aria-hidden="true">·</span>
						<PaymentMethodIcon kind={method.kind} class="size-3 shrink-0" />
						<span class="truncate"
							>{method.name}{method.last4 ? ` ${last4Label(method.last4)}` : ''}</span
						>
					{/if}
					{#if item.readBy === 'claude'}
						<span aria-hidden="true">·</span>
						<span class="flex items-center gap-0.5">
							<Sparkles class="size-3" aria-hidden="true" /> Read by Claude
						</span>
					{/if}
				</span>
			</div>
			<span class="shrink-0 text-base font-semibold tabular-nums">
				{amountCents ? formatCents(amountCents) : '—'}
			</span>
		</div>

		{#if item.note}
			<p class="flex items-start gap-1.5 text-xs">
				<TriangleAlert class="mt-px size-3.5 shrink-0 text-(--status-warning)" aria-hidden="true" />
				<span>{item.note}</span>
			</p>
		{/if}

		<form
			id="add-{item.id}"
			method="POST"
			action="?/add"
			class="flex flex-col gap-3"
			use:enhance={({ cancel }) => {
				if (busy) return cancel();
				busy = true;
				problem = null;
				const name = fields.name.trim();
				const date = parseDate(fields.date);
				return async ({ result, update }) => {
					busy = false;
					if (result.type === 'success') {
						toast.success(`Added “${name}”.`, {
							description: date ? formatDate(date) : undefined
						});
						await update();
					} else if (result.type === 'failure') {
						problem = String(result.data?.error ?? 'Something went wrong.');
						editing = true;
					} else {
						problem = 'Something went wrong. Please try again.';
					}
				};
			}}
		>
			<input type="hidden" name="id" value={item.id} />
			<input type="hidden" name="paymentMethodId" value={fields.paymentMethodId} />
			<input type="hidden" name="categoryId" value={fields.categoryId} />
			{#if editing}
				<div class="grid grid-cols-2 gap-3">
					<label class="col-span-2 flex flex-col gap-1 {fieldLabel}">
						Name
						<input class={input} name="name" bind:value={fields.name} maxlength="120" />
					</label>
					<label class="flex flex-col gap-1 {fieldLabel}">
						Amount
						<input
							class="{input} tabular-nums"
							name="amount"
							inputmode="decimal"
							placeholder="0.00"
							bind:value={fields.amount}
						/>
					</label>
					<label class="flex flex-col gap-1 {fieldLabel}">
						Date
						<input class={input} name="date" type="date" bind:value={fields.date} />
					</label>
				</div>
			{:else}
				<input type="hidden" name="name" value={fields.name} />
				<input type="hidden" name="amount" value={fields.amount} />
				<input type="hidden" name="date" value={fields.date} />
			{/if}

			{#if !isExpense}
				<button
					type="button"
					class="self-start rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
					onclick={() => (isExpense = true)}
				>
					It is a purchase
				</button>
			{:else}
				<!-- Card and category pills; the suggestions start selected. Nothing saves until Add expense. -->
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Paid with</span>
					{#each paymentMethods as m (m.id)}
						<button
							type="button"
							aria-pressed={fields.paymentMethodId === m.id}
							class="{chip} {fields.paymentMethodId === m.id ? chipOn : chipOff} py-1 text-xs"
							onclick={() => (fields.paymentMethodId = fields.paymentMethodId === m.id ? '' : m.id)}
						>
							<PaymentMethodIcon kind={m.kind} class="size-3.5" />
							{m.name}
						</button>
					{/each}
				</div>

				<div class="flex flex-col gap-1.5">
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Category</span>
						{#each shownCategories as c (c.id)}
							{@const CategoryIcon = categoryIcon(c.icon)}
							<button
								type="button"
								aria-pressed={fields.categoryId === c.id}
								class="{chip} {fields.categoryId === c.id ? chipOn : chipOff}"
								onclick={() => (fields.categoryId = fields.categoryId === c.id ? '' : c.id)}
							>
								<CategoryIcon class="size-3.5" aria-hidden="true" />
								{c.name}
							</button>
						{/each}
						{#if !showAllCategories && ordered.length > 4}
							<button
								type="button"
								class="{chip} {chipOff} text-gray-600 dark:text-gray-400"
								onclick={() => (showAllCategories = true)}
							>
								More <ChevronDown class="size-3.5" aria-hidden="true" />
							</button>
						{/if}
					</div>
					{#if !fields.categoryId}
						<p class="text-xs text-gray-500 dark:text-gray-400">Pick a category to add it.</p>
					{/if}
				</div>
			{/if}
		</form>

		{#if problem}
			<p class="text-xs text-(--status-critical)" role="alert">{problem}</p>
		{/if}
	{/if}

	<!-- Footer: the original message and the other actions -->
	<div class="flex flex-wrap items-center justify-between gap-1">
		<button
			type="button"
			class={small}
			aria-expanded={showMessage}
			onclick={() => (showMessage = !showMessage)}
		>
			<ChevronDown
				class={['size-3.5 transition-transform', showMessage && 'rotate-180']}
				aria-hidden="true"
			/>
			{showMessage ? 'Hide' : 'Show'} message
		</button>
		<div class="flex items-center gap-1">
			{#if item.status !== 'reading' && !editing}
				<button type="button" class={small} onclick={() => (editing = true)}>
					<Pencil class="size-3.5" aria-hidden="true" /> Edit details
				</button>
			{/if}
			<form
				method="POST"
				action="?/dismiss"
				use:enhance={() => {
					busy = true;
					return async ({ result, update }) => {
						busy = false;
						if (result.type === 'success') {
							toast('Removed from the inbox.');
							await update();
						} else problem = 'Couldn’t remove it. Please try again.';
					};
				}}
			>
				<input type="hidden" name="id" value={item.id} />
				<button type="submit" class={small} disabled={busy}>
					<X class="size-3.5" aria-hidden="true" /> Dismiss
				</button>
			</form>
			{#if item.status !== 'reading' && isExpense}
				<!-- The card's main action, last in the row. Green: adding is the "done" step. -->
				<button
					type="submit"
					form="add-{item.id}"
					disabled={busy || !fields.categoryId}
					title={fields.categoryId ? undefined : 'Pick a category first'}
					class="ml-1 flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-50 disabled:hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 dark:disabled:hover:bg-green-600"
				>
					<Check class="size-4" aria-hidden="true" />
					{busy ? 'Adding…' : 'Add expense'}
				</button>
			{/if}
		</div>
	</div>
	{#if showMessage}
		<p
			class="rounded-md bg-gray-50 p-3 text-xs wrap-break-word whitespace-pre-wrap text-gray-700 dark:bg-gray-900 dark:text-gray-300"
		>
			{item.message}
		</p>
	{/if}
</li>
