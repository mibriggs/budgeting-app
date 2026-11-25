<!--
	@component
	Dialog for adding one expense or income entry: type (Expense | Income), name, amount, date,
	category, what it was paid with (expenses only, optional) and notes. The page picks the
	type. With `chooseKind` (the home page's one Add button) a switch at the top can change it;
	otherwise (the transactions page's Add expense / Add income) the form is for that type only.
	Every field, dropdowns included, starts empty each time it opens. Submits to the transactions page's `create`
	action (src/routes/transactions/+page.server.ts), which validates everything and returns
	per-field errors; the current page's data reloads after a successful add. Used on the
	transactions page and the home page.

	Edit mode (pass `editing`, transactions page only): the same form pre-filled with that row,
	posting to `update`. No type switch (an expense can't become income). Save stays off until
	something changes. Delete is in the form too, after a confirm. A charge a recurring expense
	added says that editing it changes only that charge. An archived category or removed payment
	method the row already has stays pickable for it.
-->
<script lang="ts" module>
	import type { PlainDate as SavedDate } from '#lib/dates.ts';
	import type { TransactionKind as SavedKind } from '#lib/server/budget/transactions.ts';

	/** What the form just added or saved. `paymentMethodId` is null for income or when not recorded. */
	export type Saved = {
		kind: SavedKind;
		name: string;
		date: SavedDate;
		categoryId: string;
		paymentMethodId: string | null;
	};
</script>

<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import { Dialog, Select } from 'bits-ui';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { categoryIcon } from '#lib/category-icons.ts';
	import DatePicker from '#lib/components/DatePicker.svelte';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import { formatDate } from '#lib/date-range.ts';
	import { last4Label, nextOnDay, type PaymentMethodOption } from '#lib/payment-methods.ts';
	import { Temporal, type PlainDate } from '#lib/dates.ts';
	import type { CategoryOption } from '#lib/server/budget/categories.ts';
	import Repeat from '@lucide/svelte/icons/repeat';
	import type { TransactionKind, TransactionRow } from '#lib/server/budget/transactions.ts';
	import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH, parseAmount } from '#lib/transaction-input.ts';

	let {
		open = $bindable(false),
		kind = $bindable(),
		categories: allCategories,
		today,
		action: actionOverride,
		paymentMethods: activeMethods = [],
		chooseKind = false,
		editing = null,
		onCreated,
		onSaved,
		onDeleted
	}: {
		open?: boolean;
		/** Which type the form is for; the switch (with `chooseKind`) updates it. */
		kind: TransactionKind;
		/**
		 * Where the form posts. Defaults to this page's `?/create` (the transactions page). Other
		 * pages pass "/transactions?/create" to use the same action.
		 */
		action?: string;
		/** Categories to choose from for each type (archived ones already left out). */
		categories: Record<TransactionKind, CategoryOption[]>;
		/** Choices for "Paid with" on expenses (removed ones already left out). */
		paymentMethods?: PaymentMethodOption[];
		/** Show the Expense | Income switch (adding only). Off: the form is for `kind` only. */
		chooseKind?: boolean;
		/** Default date: today in the user's time zone. */
		today: PlainDate;
		/** After adding. Includes the category and payment method so a page can tell whether its
		 *  filters hide the new row. */
		onCreated: (created: Saved) => void;
		/** The row to edit; null (the default) adds a new one instead. */
		editing?: TransactionRow | null;
		/** After an edit is saved. */
		onSaved?: (saved: Saved) => void;
		/** After the row being edited is deleted from the form. */
		onDeleted?: (deleted: { kind: TransactionKind; name: string }) => void;
	} = $props();

	type Field = 'name' | 'amount' | 'date' | 'categoryId' | 'notes' | 'paymentMethodId';

	/** What was added or saved, for the page's toast. */
	function saved(): Saved {
		return {
			kind,
			name: name.trim(),
			date: date ?? today,
			categoryId,
			paymentMethodId: kind === 'expense' && paymentMethodId ? paymentMethodId : null
		};
	}

	let name = $state('');
	let amount = $state('');
	let notes = $state('');
	let categoryId = $state('');
	let paymentMethodId = $state('');
	// svelte-ignore state_referenced_locally
	let date = $state<PlainDate | null>(today);
	let errors = $state<Partial<Record<Field, string>>>({});
	let formError = $state('');
	let pending = $state(false);
	let confirmDelete = $state(false);

	// When editing, the row's own category and payment method stay pickable even if archived.
	let categories = $derived.by(() => {
		const list = allCategories[kind];
		if (!editing || list.some((c) => c.id === editing.categoryId)) return list;
		return [
			...list,
			{ id: editing.categoryId, name: editing.categoryName, icon: editing.categoryIcon }
		];
	});
	let paymentMethods = $derived.by<PaymentMethodOption[]>(() => {
		const e = editing;
		if (!e?.paymentMethodId || !e.paymentMethodKind || !e.paymentMethodName) return activeMethods;
		if (activeMethods.some((m) => m.id === e.paymentMethodId)) return activeMethods;
		return [
			...activeMethods,
			{
				id: e.paymentMethodId,
				kind: e.paymentMethodKind,
				name: e.paymentMethodName,
				last4: e.paymentMethodLast4,
				closingDay: null
			}
		];
	});
	let label = $derived(kind === 'expense' ? 'expense' : 'income');
	let selectedCategory = $derived(categories.find((c) => c.id === categoryId));
	let selectedMethod = $derived(paymentMethods.find((m) => m.id === paymentMethodId));
	// For a credit card with a closing day: which statement this purchase lands on.
	let statementNote = $derived(
		selectedMethod?.kind === 'credit' && selectedMethod.closingDay && date
			? `Goes on the statement that closes ${formatDate(nextOnDay(date, selectedMethod.closingDay))}.`
			: ''
	);
	let amountHint = $derived(amount && parseAmount(amount) === null ? 'Like 12.50' : '');

	// On the transactions page, keep the current range and tab in the URL; `/create` picks the
	// form action.
	const pageAction = (name: string) => `${page.url.search ? `${page.url.search}&` : '?'}/${name}`;
	let action = $derived(editing ? pageAction('update') : (actionOverride ?? pageAction('create')));

	// Edit mode: Save only once something differs from the row.
	let changed = $derived.by(() => {
		if (!editing) return true;
		return (
			name.trim() !== editing.name ||
			parseAmount(amount) !== editing.amountCents ||
			!date?.equals(editing.date) ||
			categoryId !== editing.categoryId ||
			notes.trim() !== (editing.notes ?? '') ||
			(kind === 'expense' && paymentMethodId !== (editing.paymentMethodId ?? ''))
		);
	});

	// Start fresh each time the dialog opens. An effect rather than Bits' onOpenChange, which only
	// fires when the dialog opens itself (trigger/Escape), not when the page sets `open = true`.
	$effect(() => {
		if (open) untrack(reset);
	});

	// Switching type swaps the category list, so the picked category no longer applies.
	function setKind(next: TransactionKind) {
		if (next === kind) return;
		kind = next;
		categoryId = '';
		errors = { ...errors, categoryId: undefined };
	}

	function reset() {
		confirmDelete = false;
		if (editing) {
			name = editing.name;
			amount = (editing.amountCents / 100).toFixed(2);
			notes = editing.notes ?? '';
			errors = {};
			formError = '';
			date = editing.date;
			categoryId = editing.categoryId;
			paymentMethodId = editing.paymentMethodId ?? '';
			return;
		}
		name = '';
		amount = '';
		notes = '';
		errors = {};
		formError = '';
		date = today;
		categoryId = '';
		paymentMethodId = '';
	}

	// Dates run 1940 to next year (so a payment due in early January can be entered).
	const DATE_MIN = Temporal.PlainDate.from('1940-01-01');
	const DATE_MAX = Temporal.PlainDate.from({
		year: new Date().getFullYear() + 1,
		month: 12,
		day: 31
	});

	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-sm font-medium';
	const errorText = 'text-xs text-red-700 dark:text-red-400';
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<Dialog.Title class="text-base font-semibold">
				{editing ? 'Edit' : 'Add'}
				{label}
			</Dialog.Title>

			{#if editing?.recurringName}
				<p
					class="mt-3 flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
				>
					<Repeat class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
					<span>
						Added by your recurring “{editing.recurringName}”. Changes here only affect this charge,
						not future ones.
					</span>
				</p>
			{/if}

			<form
				method="post"
				{action}
				class="mt-4 flex flex-col gap-4"
				use:enhance={({ action: submitted }) => {
					const deleting = submitted.search.includes('/delete');
					pending = true;
					formError = '';
					return async ({ result, update }) => {
						pending = false;
						if (result.type === 'success' && deleting) {
							open = false;
							onDeleted?.({ kind, name: editing?.name ?? name.trim() });
							await update({ reset: false });
						} else if (result.type === 'success' && editing) {
							open = false;
							onSaved?.(saved());
							await update({ reset: false });
						} else if (result.type === 'success') {
							open = false;
							onCreated(saved());
							// Stay on the current page (e.g. home) even though the action lives on
							// /transactions; still reload this page's data.
							await update({ reset: false, navigate: false });
						} else if (result.type === 'failure') {
							errors = (result.data?.errors as typeof errors) ?? {};
							if (result.data?.error) formError = String(result.data.error);
							confirmDelete = false;
						} else if (result.type === 'error') {
							formError = navigator.onLine
								? 'Something went wrong. Please try again.'
								: `You're offline. ${editing ? 'Saving' : 'Adding'} needs a connection.`;
						} else {
							await update();
						}
					};
				}}
			>
				{#if editing}
					<input type="hidden" name="kind" value={kind} />
					<input type="hidden" name="id" value={editing.id} />
				{:else if !chooseKind}
					<input type="hidden" name="kind" value={kind} />
				{:else}
					<!-- Type: a two-option radio group styled as a segmented switch. -->
					<fieldset
						class="grid grid-cols-2 gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
					>
						<legend class="sr-only">Type</legend>
						{#each [['expense', 'Expense'], ['income', 'Income']] as const as [value, text] (value)}
							<label
								class="cursor-pointer rounded px-3 py-1.5 text-center text-sm font-medium text-gray-600 transition hover:text-gray-900 has-checked:bg-gray-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:text-gray-100 dark:has-checked:bg-white dark:has-checked:text-gray-900"
							>
								<input
									type="radio"
									name="kind"
									{value}
									checked={kind === value}
									onchange={() => setKind(value)}
									class="sr-only"
								/>
								{text}
							</label>
						{/each}
					</fieldset>
				{/if}

				<div class="flex flex-col gap-1">
					<label for="add-name" class={fieldLabel}>Name</label>
					<input
						id="add-name"
						autocapitalize="words"
						name="name"
						bind:value={name}
						required
						maxlength={MAX_NAME_LENGTH}
						autocomplete="off"
						placeholder={kind === 'expense' ? 'e.g. Trader Joe’s' : 'e.g. Paycheck'}
						class={input}
						aria-invalid={errors.name ? true : undefined}
						aria-describedby={errors.name ? 'add-name-error' : undefined}
					/>
					{#if errors.name}<p id="add-name-error" class={errorText}>{errors.name}</p>{/if}
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="flex flex-col gap-1">
						<label for="add-amount" class={fieldLabel}>Amount</label>
						<div class="relative">
							<span
								class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
								aria-hidden="true">$</span
							>
							<input
								id="add-amount"
								name="amount"
								bind:value={amount}
								required
								inputmode="decimal"
								autocomplete="off"
								placeholder="0.00"
								class="{input} pl-7 tabular-nums"
								aria-invalid={errors.amount ? true : undefined}
								aria-describedby="add-amount-hint"
							/>
						</div>
						<p id="add-amount-hint" class={errors.amount ? errorText : 'text-xs text-gray-500'}>
							{errors.amount ?? amountHint}
						</p>
					</div>

					<div class="flex flex-col gap-1">
						<span id="add-date-label" class={fieldLabel}>Date</span>
						<input type="hidden" name="date" value={date?.toString() ?? ''} />
						<DatePicker
							bind:value={date}
							labelledby="add-date-label"
							min={DATE_MIN}
							max={DATE_MAX}
							invalid={Boolean(errors.date)}
						/>
						{#if errors.date}<p class={errorText}>{errors.date}</p>{/if}
					</div>
				</div>

				<div class="flex flex-col gap-1">
					<span id="add-category-label" class={fieldLabel}>Category</span>
					<Select.Root
						type="single"
						name="categoryId"
						bind:value={categoryId}
						items={categories.map((c) => ({ value: c.id, label: c.name }))}
					>
						<!-- data-no-press: a field, not a button, so it skips the press-to-shrink effect. -->
						<Select.Trigger
							data-no-press
							class="{input} flex items-center gap-2 border px-3 py-2 text-left"
							aria-labelledby="add-category-label"
							aria-invalid={errors.categoryId ? true : undefined}
						>
							{#if selectedCategory}
								{@const Icon = categoryIcon(selectedCategory.icon)}
								<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
								<span class="truncate">{selectedCategory.name}</span>
							{:else}
								<span class="text-gray-400">Pick a category</span>
							{/if}
							<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
						</Select.Trigger>
						<Select.Portal>
							<Select.Content
								sideOffset={4}
								class="z-60 max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900"
							>
								<Select.Viewport>
									{#each categories as category (category.id)}
										{@const Icon = categoryIcon(category.icon)}
										<Select.Item
											value={category.id}
											label={category.name}
											class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800"
										>
											{#snippet children({ selected })}
												<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
												<span class="truncate">{category.name}</span>
												{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
					{#if errors.categoryId}<p class={errorText}>{errors.categoryId}</p>{/if}
					{#if categories.length === 0}
						<p class="text-xs text-gray-500">No {label} categories yet.</p>
					{/if}
				</div>

				{#if kind === 'expense' && paymentMethods.length > 0}
					<div class="flex flex-col gap-1">
						<span id="add-paid-label" class={fieldLabel}>
							Paid with <span class="font-normal text-gray-500">(optional)</span>
						</span>
						<Select.Root
							type="single"
							name="paymentMethodId"
							bind:value={paymentMethodId}
							items={[
								{ value: '', label: 'Not recorded' },
								...paymentMethods.map((m) => ({ value: m.id, label: m.name }))
							]}
						>
							<!-- data-no-press: a field, not a button, so it skips the press-to-shrink effect. -->
							<Select.Trigger
								data-no-press
								class="{input} flex items-center gap-2 border px-3 py-2 text-left"
								aria-labelledby="add-paid-label"
								aria-invalid={errors.paymentMethodId ? true : undefined}
							>
								{#if selectedMethod}
									<PaymentMethodIcon
										kind={selectedMethod.kind}
										class="size-4 shrink-0 text-gray-500"
									/>
									<span class="truncate">{selectedMethod.name}</span>
									{#if selectedMethod.last4}
										<span class="shrink-0 text-gray-500 tabular-nums">
											{last4Label(selectedMethod.last4)}
										</span>
									{/if}
								{:else}
									<span class="text-gray-400">Not recorded</span>
								{/if}
								<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
							</Select.Trigger>
							<Select.Portal>
								<Select.Content
									sideOffset={4}
									class="z-60 max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900"
								>
									<Select.Viewport>
										<Select.Item
											value=""
											label="Not recorded"
											class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800"
										>
											{#snippet children({ selected })}
												<span class="text-gray-500">Not recorded</span>
												{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
										{#each paymentMethods as method (method.id)}
											<Select.Item
												value={method.id}
												label={method.name}
												class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800"
											>
												{#snippet children({ selected })}
													<PaymentMethodIcon
														kind={method.kind}
														class="size-4 shrink-0 text-gray-500"
													/>
													<span class="truncate">{method.name}</span>
													{#if method.last4}
														<span class="shrink-0 text-xs text-gray-500 tabular-nums">
															{last4Label(method.last4)}
														</span>
													{/if}
													{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
												{/snippet}
											</Select.Item>
										{/each}
									</Select.Viewport>
								</Select.Content>
							</Select.Portal>
						</Select.Root>
						{#if errors.paymentMethodId}
							<p class={errorText}>{errors.paymentMethodId}</p>
						{:else if statementNote}
							<p class="text-xs text-gray-500">{statementNote}</p>
						{/if}
					</div>
				{/if}

				<div class="flex flex-col gap-1">
					<label for="add-notes" class={fieldLabel}>
						Notes <span class="font-normal text-gray-500">(optional)</span>
					</label>
					<textarea
						id="add-notes"
						name="notes"
						bind:value={notes}
						rows="2"
						maxlength={MAX_NOTES_LENGTH}
						class={input}
						aria-invalid={errors.notes ? true : undefined}></textarea>
					{#if errors.notes}<p class={errorText}>{errors.notes}</p>{/if}
				</div>

				{#if formError}
					<p class="text-sm text-red-700 dark:text-red-400" role="alert">{formError}</p>
				{/if}

				{#if confirmDelete && editing}
					<div
						class="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
					>
						<p>Delete <strong>{editing.name}</strong>? This can’t be undone.</p>
						<div class="flex justify-end gap-2">
							<button
								type="button"
								onclick={() => (confirmDelete = false)}
								class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
							>
								Keep
							</button>
							<button
								formaction={pageAction('delete')}
								disabled={pending}
								class="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
							>
								{pending ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center justify-end gap-2">
						{#if editing}
							<button
								type="button"
								onclick={() => (confirmDelete = true)}
								class="mr-auto rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
							>
								Delete
							</button>
						{/if}
						<Dialog.Close
							type="button"
							class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
						>
							Cancel
						</Dialog.Close>
						<button
							type="submit"
							disabled={pending || !changed}
							class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{#if editing}
								{pending ? 'Saving…' : 'Save'}
							{:else}
								{pending ? 'Adding…' : `Add ${label}`}
							{/if}
						</button>
					</div>
				{/if}
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
