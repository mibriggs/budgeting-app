<!--
	@component
	Dialog for adding one expense or income entry: name, amount, date, category and notes.
	Submits to the transactions page's `create` action (src/routes/transactions/+page.server.ts),
	which validates everything and returns per-field errors; the current page's data reloads
	after a successful add. Used on the transactions page and the home page.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import {
		CalendarDate,
		parseDate as parseCalendarDate,
		type DateValue
	} from '@internationalized/date';
	import { Calendar, Dialog, Popover, Select } from 'bits-ui';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { Temporal, type PlainDate } from '#lib/dates.ts';
	import { formatDate } from '#lib/date-range.ts';
	import type { CategoryOption } from '#lib/server/budget/categories.ts';
	import type { TransactionKind } from '#lib/server/budget/transactions.ts';
	import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH, parseAmount } from '#lib/transaction-input.ts';

	let {
		open = $bindable(false),
		kind,
		categories,
		today,
		action: actionOverride,
		onCreated
	}: {
		open?: boolean;
		kind: TransactionKind;
		/**
		 * Where the form posts. Defaults to this page's `?/create` (the transactions page). Other
		 * pages pass "/transactions?/create" to use the same action.
		 */
		action?: string;
		/** Categories to choose from (archived ones already left out). */
		categories: CategoryOption[];
		/** Default date: today in the user's time zone. */
		today: PlainDate;
		onCreated: (created: { name: string; date: PlainDate }) => void;
	} = $props();

	type Field = 'name' | 'amount' | 'date' | 'categoryId' | 'notes';

	let name = $state('');
	let amount = $state('');
	let notes = $state('');
	let categoryId = $state('');
	let date = $state<DateValue>(new CalendarDate(2000, 1, 1));
	let dateOpen = $state(false);
	let errors = $state<Partial<Record<Field, string>>>({});
	let formError = $state('');
	let pending = $state(false);

	// Remember the last category used for each kind during this visit; it's often the same.
	const lastCategory: Partial<Record<TransactionKind, string>> = {};

	let label = $derived(kind === 'expense' ? 'expense' : 'income');
	let selectedCategory = $derived(categories.find((c) => c.id === categoryId));
	let amountHint = $derived(amount && parseAmount(amount) === null ? 'Like 12.50' : '');

	// On the transactions page, keep the current range and tab in the URL; `/create` picks the
	// form action.
	let action = $derived(
		actionOverride ?? `${page.url.search ? `${page.url.search}&` : '?'}/create`
	);

	// Start fresh each time the dialog opens. An effect rather than Bits' onOpenChange, which only
	// fires when the dialog opens itself (trigger/Escape), not when the page sets `open = true`.
	$effect(() => {
		if (open) untrack(reset);
	});

	function reset() {
		name = '';
		amount = '';
		notes = '';
		errors = {};
		formError = '';
		date = parseCalendarDate(today.toString());
		const last = lastCategory[kind];
		categoryId = last && categories.some((c) => c.id === last) ? last : '';
	}

	// The calendar runs 1940 to next year (so a payment due in early January can be entered).
	const thisYear = new Date().getFullYear();
	const years = Array.from({ length: thisYear + 1 - 1940 + 1 }, (_, i) => thisYear + 1 - i);
	const minValue = new CalendarDate(1940, 1, 1);
	const maxValue = new CalendarDate(thisYear + 1, 12, 31);

	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-sm font-medium';
	const errorText = 'text-xs text-red-700 dark:text-red-400';
	const select =
		'cursor-pointer rounded-md border-0 bg-transparent py-1 pr-7 pl-2 text-sm font-semibold hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 dark:bg-transparent dark:hover:bg-gray-800';
	const day = [
		'relative flex size-9 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums',
		'hover:bg-gray-100 dark:hover:bg-gray-800',
		'data-selected:bg-gray-900 data-selected:text-white dark:data-selected:bg-white dark:data-selected:text-gray-900',
		'data-outside-month:text-gray-300 dark:data-outside-month:text-gray-600',
		'data-disabled:pointer-events-none data-disabled:opacity-30',
		'data-today:after:absolute data-today:after:bottom-1 data-today:after:left-1/2 data-today:after:size-1 data-today:after:-translate-x-1/2 data-today:after:rounded-full data-today:after:bg-current data-today:after:opacity-60'
	].join(' ');
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<Dialog.Title class="text-base font-semibold">Add {label}</Dialog.Title>

			<form
				method="post"
				{action}
				class="mt-4 flex flex-col gap-4"
				use:enhance={() => {
					pending = true;
					formError = '';
					return async ({ result, update }) => {
						pending = false;
						if (result.type === 'success') {
							lastCategory[kind] = categoryId;
							open = false;
							onCreated({ name: name.trim(), date: Temporal.PlainDate.from(date.toString()) });
							// Stay on the current page (e.g. home) even though the action lives on
							// /transactions; still reload this page's data.
							await update({ reset: false, navigate: false });
						} else if (result.type === 'failure') {
							errors = (result.data?.errors as typeof errors) ?? {};
						} else if (result.type === 'error') {
							formError = navigator.onLine
								? 'Something went wrong. Please try again.'
								: "You're offline. Adding needs a connection.";
						} else {
							await update();
						}
					};
				}}
			>
				<input type="hidden" name="kind" value={kind} />

				<div class="flex flex-col gap-1">
					<label for="add-name" class={fieldLabel}>Name</label>
					<input
						id="add-name"
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
						<input type="hidden" name="date" value={date.toString()} />
						<Popover.Root bind:open={dateOpen}>
							<Popover.Trigger
								class="{input} flex items-center justify-between border px-3 py-2 text-left"
								aria-labelledby="add-date-label add-date-value"
								aria-invalid={errors.date ? true : undefined}
							>
								<span id="add-date-value"
									>{formatDate(Temporal.PlainDate.from(date.toString()))}</span
								>
								<CalendarIcon class="size-4 text-gray-500" aria-hidden="true" />
							</Popover.Trigger>
							<Popover.Portal>
								<Popover.Content
									sideOffset={6}
									align="start"
									collisionPadding={8}
									class="z-[60] rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
								>
									<Calendar.Root
										type="single"
										value={date}
										onValueChange={(value) => {
											if (!value) return;
											date = value;
											dateOpen = false;
										}}
										{minValue}
										{maxValue}
										preventDeselect
										weekdayFormat="short"
										fixedWeeks
									>
										{#snippet children({ months, weekdays })}
											<Calendar.Header class="mb-2 flex items-center justify-center gap-1">
												<Calendar.Heading class="sr-only" />
												<Calendar.MonthSelect monthFormat="short" class={select} />
												<Calendar.YearSelect {years} class={select} />
											</Calendar.Header>
											{#each months as month (month.value)}
												<Calendar.Grid>
													<Calendar.GridHead>
														<Calendar.GridRow class="flex">
															{#each weekdays as weekday (weekday)}
																<Calendar.HeadCell
																	class="w-9 text-center text-xs font-normal text-gray-500"
																>
																	{weekday.slice(0, 2)}
																</Calendar.HeadCell>
															{/each}
														</Calendar.GridRow>
													</Calendar.GridHead>
													<Calendar.GridBody>
														{#each month.weeks as week, i (i)}
															<Calendar.GridRow class="flex">
																{#each week as cellDate (cellDate.toString())}
																	<Calendar.Cell date={cellDate} month={month.value} class="p-0">
																		<Calendar.Day class={day} />
																	</Calendar.Cell>
																{/each}
															</Calendar.GridRow>
														{/each}
													</Calendar.GridBody>
												</Calendar.Grid>
											{/each}
										{/snippet}
									</Calendar.Root>
								</Popover.Content>
							</Popover.Portal>
						</Popover.Root>
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
						<Select.Trigger
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
								class="z-[60] max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
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

				<div class="flex justify-end gap-2">
					<Dialog.Close
						type="button"
						class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
					>
						Cancel
					</Dialog.Close>
					<button
						type="submit"
						disabled={pending}
						class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						{pending ? 'Adding…' : `Add ${label}`}
					</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
