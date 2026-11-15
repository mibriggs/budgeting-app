<!--
	Mock: Settings → Payment methods, and the add-expense form with a "Paid with" field
	(future-plans, "Payment methods"). Sample data; changes live only until reload.

	- Kinds you add: credit card, debit card, pay app (Venmo, Zelle…). Cash is built in.
	- Credit cards: optional last 4 digits and limit, and two optional dates picked on the usual
	  calendar: statement closing and payment due. Only the day of the month is kept; it repeats
	  every month. A reminder time appears once there's a due date.
	- Expense form: "Paid with" under Category, starting on the last one used. For a credit card
	  with a closing date it says which statement the purchase lands on.
-->
<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Plus from '@lucide/svelte/icons/plus';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import X from '@lucide/svelte/icons/x';
	import { Dialog, Select } from 'bits-ui';
	import { categoryIcon, type CategoryIconName } from '#lib/category-icons.ts';
	import DatePicker from '#lib/components/DatePicker.svelte';
	import { formatDate } from '#lib/date-range.ts';
	import { Temporal, type PlainDate } from '#lib/dates.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import { ordinal } from '#lib/recurring-schedule.ts';
	import { parseAmount } from '#lib/transaction-input.ts';

	type Kind = 'credit' | 'debit' | 'cash' | 'p2p';
	type Method = {
		id: string;
		kind: Kind;
		name: string;
		last4: string | null;
		/** Credit only, all optional. */
		limitCents: number | null;
		closingDay: number | null;
		dueDay: number | null;
		remindHour: number;
		/** Mock: this month's spending through it. */
		spentCents: number;
	};

	const today = Temporal.Now.plainDateISO();

	const SAMPLE: Method[] = [
		{
			id: 'm1',
			kind: 'credit',
			name: 'Chase Sapphire',
			last4: '4821',
			limitCents: 500000,
			closingDay: 8,
			dueDay: 3,
			remindHour: 9,
			spentCents: 84210
		},
		{
			id: 'm2',
			kind: 'credit',
			name: 'Amex Gold',
			last4: '1007',
			limitCents: null,
			closingDay: null,
			dueDay: null,
			remindHour: 12,
			spentCents: 21340
		},
		{
			id: 'm3',
			kind: 'debit',
			name: 'Checking',
			last4: '5532',
			limitCents: null,
			closingDay: null,
			dueDay: null,
			remindHour: 12,
			spentCents: 39125
		},
		{
			id: 'm4',
			kind: 'p2p',
			name: 'Venmo',
			last4: null,
			limitCents: null,
			closingDay: null,
			dueDay: null,
			remindHour: 12,
			spentCents: 6000
		}
	];
	const CASH: Method = {
		id: 'cash',
		kind: 'cash',
		name: 'Cash',
		last4: null,
		limitCents: null,
		closingDay: null,
		dueDay: null,
		remindHour: 12,
		spentCents: 2400
	};

	let methods = $state<Method[]>(SAMPLE.map((m) => ({ ...m })));
	let empty = $state(false);
	const shown = $derived([...(empty ? [] : methods), CASH]);

	const KIND: Record<Kind, { label: string; icon: typeof CreditCard; example: string }> = {
		credit: { label: 'Credit card', icon: CreditCard, example: 'e.g. Chase Sapphire' },
		debit: { label: 'Debit card', icon: Landmark, example: 'e.g. Checking' },
		p2p: { label: 'Pay app', icon: Smartphone, example: 'e.g. Venmo' },
		cash: { label: 'Cash', icon: Banknote, example: '' }
	};
	const ADDABLE: [Exclude<Kind, 'cash'>, string][] = [
		['credit', 'Credit'],
		['debit', 'Debit'],
		['p2p', 'Pay app']
	];

	// --- Dates: a day of the month, clamped to short months (31st → Feb 28) ---

	function onDay(month: Temporal.PlainYearMonth, day: number): PlainDate {
		return month.toPlainDate({ day: Math.min(day, month.daysInMonth) });
	}
	/** The first date on or after `from` that falls on `day` of its month. */
	function nextOnDay(from: PlainDate, day: number): PlainDate {
		const month = from.toPlainYearMonth();
		const here = onDay(month, day);
		return Temporal.PlainDate.compare(here, from) >= 0
			? here
			: onDay(month.add({ months: 1 }), day);
	}
	const short = (d: PlainDate) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

	function hourLabel(h: number): string {
		if (h === 0) return '12 AM (midnight)';
		if (h === 12) return '12 PM (noon)';
		return `${h % 12} ${h < 12 ? 'AM' : 'PM'}`;
	}
	const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }));

	// The icon already shows the kind, so cards show their last 4 digits instead when known.
	function subtitle(m: Method): string {
		if (m.kind === 'cash') return 'Always available';
		const parts = [m.last4 ? `•• ${m.last4}` : KIND[m.kind].label];
		if (m.kind === 'credit' && m.dueDay) parts.push(`Due ${short(nextOnDay(today, m.dueDay))}`);
		return parts.join(' · ');
	}

	// --- Add / edit dialog ---

	let open = $state(false);
	let editing = $state<string | null>(null);
	let kind = $state<Exclude<Kind, 'cash'>>('credit');
	let name = $state('');
	let last4 = $state('');
	let limit = $state('');
	let closing = $state<PlainDate | null>(null);
	let due = $state<PlainDate | null>(null);
	let remindHour = $state('12');
	let submitted = $state(false);

	const errors = $derived({
		name: name.trim() ? undefined : 'Give it a name.',
		last4: !last4 || /^\d{4}$/.test(last4) ? undefined : 'Just the last 4 digits.',
		limit: !limit || parseAmount(limit) !== null ? undefined : 'Like 5000'
	});
	const hasErrors = $derived(Object.values(errors).some(Boolean));

	// Picked dates can be up to a year either side of today; only their day of the month is kept.
	const DATE_MIN = today.subtract({ years: 1 });
	const DATE_MAX = today.add({ years: 1 });

	function openAdd(k: Exclude<Kind, 'cash'> = 'credit') {
		editing = null;
		kind = k;
		name = last4 = limit = '';
		closing = due = null;
		remindHour = '12';
		submitted = false;
		open = true;
	}

	function openEdit(m: Method) {
		if (m.kind === 'cash') return;
		editing = m.id;
		kind = m.kind;
		name = m.name;
		last4 = m.last4 ?? '';
		limit = m.limitCents === null ? '' : String(m.limitCents / 100);
		closing = m.closingDay ? nextOnDay(today, m.closingDay) : null;
		due = m.dueDay ? nextOnDay(today, m.dueDay) : null;
		remindHour = String(m.remindHour);
		submitted = false;
		open = true;
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (hasErrors) return;
		const credit = kind === 'credit';
		const cents = credit && limit ? parseAmount(limit) : null;
		const saved: Method = {
			id: editing ?? crypto.randomUUID(),
			kind,
			name: name.trim(),
			last4: kind === 'p2p' ? null : last4 || null,
			limitCents: cents,
			closingDay: credit ? (closing?.day ?? null) : null,
			dueDay: credit ? (due?.day ?? null) : null,
			remindHour: Number(remindHour),
			spentCents: methods.find((m) => m.id === editing)?.spentCents ?? 0
		};
		methods = editing ? methods.map((m) => (m.id === editing ? saved : m)) : [...methods, saved];
		empty = false;
		open = false;
	}

	function remove() {
		methods = methods.filter((m) => m.id !== editing);
		if (lastPaidWith === editing) lastPaidWith = '';
		open = false;
	}

	function repeatsText(d: PlainDate | null): string {
		if (!d) return '';
		return `Every month on the ${ordinal(d.day)}${d.day > 28 ? ' (or the month’s last day)' : ''}.`;
	}

	// --- Expense form ---

	const CATEGORIES: { id: string; name: string; icon: CategoryIconName }[] = [
		{ id: 'c1', name: 'Groceries', icon: 'shopping-cart' },
		{ id: 'c2', name: 'Eating out', icon: 'utensils-crossed' },
		{ id: 'c3', name: 'Gas', icon: 'fuel' }
	];

	let expenseOpen = $state(false);
	let expenseName = $state('');
	let amount = $state('');
	let date = $state<PlainDate | null>(today);
	let categoryId = $state('c1');
	let paidWith = $state('');
	// Starts on the last one used (the real form would remember it per device or per user).
	let lastPaidWith = $state('m1');

	const paidWithOptions = $derived(shown);
	const selectedMethod = $derived(paidWithOptions.find((m) => m.id === paidWith));
	const selectedCategory = $derived(CATEGORIES.find((c) => c.id === categoryId));
	const statementNote = $derived.by(() => {
		const m = selectedMethod;
		if (!m || m.kind !== 'credit' || !m.closingDay || !date) return '';
		return `Goes on the statement that closes ${formatDate(nextOnDay(date, m.closingDay))}.`;
	});

	function openExpense() {
		expenseName = '';
		amount = '';
		date = today;
		categoryId = 'c1';
		paidWith = paidWithOptions.some((m) => m.id === lastPaidWith) ? lastPaidWith : '';
		expenseOpen = true;
	}

	function addExpense(event: SubmitEvent) {
		event.preventDefault();
		lastPaidWith = paidWith;
		expenseOpen = false;
	}

	// --- Styles (same as the real forms) ---

	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-sm font-medium';
	const optional = 'font-normal text-gray-500';
	const hint = 'text-xs text-gray-500 dark:text-gray-400';
	const errorText = 'text-xs text-red-700 dark:text-red-400';
	const dialog =
		'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const selectContent =
		'z-[60] max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900';
	const selectItem =
		'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800';
	const primary =
		'rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
	const secondary =
		'rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
	const toggle =
		'rounded-md border border-gray-300 px-2.5 py-1 text-xs aria-pressed:bg-gray-900 aria-pressed:text-white dark:border-gray-700 dark:aria-pressed:bg-white dark:aria-pressed:text-gray-900';
</script>

<svelte:head>
	<title>Payment methods mock</title>
</svelte:head>

{#snippet row(m: Method)}
	{@const Icon = KIND[m.kind].icon}
	<span class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800">
		<Icon class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
	</span>
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="truncate text-sm font-medium">{m.name}</span>
		<span class="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle(m)}</span>
	</span>
	<span class="flex shrink-0 flex-col items-end">
		<span class="text-sm tabular-nums">{formatCents(m.spentCents)}</span>
		{#if m.limitCents}
			<span class="text-xs text-gray-500 tabular-nums dark:text-gray-400">
				{Math.round((m.spentCents / m.limitCents) * 100)}% of {formatCentsWhole(m.limitCents)}
			</span>
		{:else}
			<span class="text-xs text-gray-500 dark:text-gray-400">this month</span>
		{/if}
	</span>
{/snippet}

<!-- Mock controls (not part of the page) -->
<div
	class="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-dashed border-gray-300 bg-gray-50/90 px-4 py-2 text-xs backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"
>
	<span class="font-medium text-gray-500">Mock:</span>
	<button type="button" class={toggle} aria-pressed={empty} onclick={() => (empty = !empty)}>
		No methods yet
	</button>
	<button type="button" class={toggle} onclick={() => openAdd('credit')}>Add credit card</button>
	<button type="button" class={toggle} onclick={() => openEdit(methods[0])} disabled={!methods[0]}>
		Edit first card
	</button>
	<button type="button" class={toggle} onclick={openExpense}>Add expense form</button>
</div>

<main class="mx-auto flex max-w-3xl flex-col gap-10 p-4 sm:p-6">
	<!-- Settings → Payment methods -->
	<section aria-labelledby="section-title">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h2 id="section-title" class="text-lg font-semibold">Payment methods</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Cards and apps you pay with. Pick one when you add an expense to see what went where.
				</p>
			</div>
			<button
				type="button"
				onclick={() => openAdd()}
				class="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
			>
				<Plus class="size-4" aria-hidden="true" />
				Add method
			</button>
		</div>

		{#if empty}
			<p
				class="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
			>
				No cards or apps yet. Add a credit card, debit card or an app like Venmo.
			</p>
		{/if}

		<ul
			class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
		>
			{#each shown as m (m.id)}
				<li>
					{#if m.kind === 'cash'}
						<div class="flex w-full items-center gap-3 px-3 py-2.5">
							{@render row(m)}
						</div>
					{:else}
						<button
							type="button"
							onclick={() => openEdit(m)}
							data-no-press
							class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
						>
							{@render row(m)}
						</button>
					{/if}
				</li>
			{/each}
		</ul>

		<p class="mt-3 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
			<Bell class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<span>
				Credit cards with a due date get a reminder the day before and the day of, on devices with
				notifications turned on.
			</span>
		</p>
	</section>

	<p class="text-center text-xs text-gray-400">
		Use “Add expense form” above to see the “Paid with” field.
	</p>
</main>

<!-- Add / edit payment method -->
<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content class={dialog}>
			<div class="flex items-start justify-between gap-3">
				<Dialog.Title class="text-base font-semibold">
					{editing ? 'Edit payment method' : 'Add payment method'}
				</Dialog.Title>
				<Dialog.Close
					class="-m-1 rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					<X class="size-4" aria-hidden="true" />
					<span class="sr-only">Close</span>
				</Dialog.Close>
			</div>

			<form class="mt-4 flex flex-col gap-4" novalidate onsubmit={save}>
				<fieldset
					class="grid grid-cols-3 gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
				>
					<legend class="sr-only">Type</legend>
					{#each ADDABLE as [value, text] (value)}
						<label
							class="cursor-pointer rounded px-2 py-1.5 text-center text-sm font-medium text-gray-600 transition hover:text-gray-900 has-checked:bg-gray-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:text-gray-100 dark:has-checked:bg-white dark:has-checked:text-gray-900"
						>
							<input type="radio" name="kind" {value} bind:group={kind} class="sr-only" />
							{text}
						</label>
					{/each}
				</fieldset>

				<div class="flex flex-col gap-1">
					<label for="pm-name" class={fieldLabel}>Name</label>
					<input
						id="pm-name"
						bind:value={name}
						maxlength="40"
						autocomplete="off"
						placeholder={KIND[kind].example}
						class={input}
						aria-invalid={submitted && errors.name ? true : undefined}
					/>
					{#if kind === 'p2p'}
						<p class={hint}>Venmo, Cash App, Zelle, PayPal, Apple Cash…</p>
					{/if}
					{#if submitted && errors.name}<p class={errorText}>{errors.name}</p>{/if}
				</div>

				{#if kind !== 'p2p'}
					<div class={kind === 'credit' ? 'grid gap-4 sm:grid-cols-2 sm:gap-3' : 'flex flex-col'}>
						<div class="flex flex-col gap-1">
							<label for="pm-last4" class={fieldLabel}>
								Last 4 digits <span class={optional}>(optional)</span>
							</label>
							<input
								id="pm-last4"
								bind:value={last4}
								inputmode="numeric"
								maxlength="4"
								autocomplete="off"
								placeholder="1234"
								class="{input} tabular-nums"
								aria-invalid={submitted && errors.last4 ? true : undefined}
							/>
							{#if submitted && errors.last4}
								<p class={errorText}>{errors.last4}</p>
							{:else}
								<p class={hint}>Only to tell cards apart.</p>
							{/if}
						</div>

						{#if kind === 'credit'}
							<div class="flex flex-col gap-1">
								<label for="pm-limit" class={fieldLabel}>
									Credit limit <span class={optional}>(optional)</span>
								</label>
								<div class="relative">
									<span
										class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
										aria-hidden="true">$</span
									>
									<input
										id="pm-limit"
										bind:value={limit}
										inputmode="decimal"
										autocomplete="off"
										placeholder="5000"
										class="{input} pl-7 tabular-nums"
										aria-invalid={submitted && errors.limit ? true : undefined}
									/>
								</div>
								{#if submitted && errors.limit}<p class={errorText}>{errors.limit}</p>{/if}
							</div>
						{/if}
					</div>
				{/if}

				{#if kind === 'credit'}
					<div class="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
						<p class={hint}>
							Pick the next one of each from your statement. They repeat every month; leave them
							empty if you don’t know them.
						</p>

						{#each [{ id: 'pm-closing', text: 'Statement closing date', get: () => closing, set: (d: PlainDate | null) => (closing = d) }, { id: 'pm-due', text: 'Payment due date', get: () => due, set: (d: PlainDate | null) => (due = d) }] as field (field.id)}
							<div class="flex flex-col gap-1">
								<div class="flex items-baseline justify-between gap-2">
									<span id="{field.id}-label" class={fieldLabel}>
										{field.text} <span class={optional}>(optional)</span>
									</span>
									{#if field.get()}
										<button
											type="button"
											class="text-xs text-gray-500 underline hover:text-gray-900 dark:hover:text-gray-100"
											onclick={() => field.set(null)}
										>
											Clear
										</button>
									{/if}
								</div>
								<DatePicker
									bind:value={field.get, field.set}
									labelledby="{field.id}-label"
									min={DATE_MIN}
									max={DATE_MAX}
								/>
								{#if field.get()}<p class={hint}>{repeatsText(field.get())}</p>{/if}
							</div>
						{/each}

						{#if due}
							<div class="flex flex-col gap-1">
								<span id="pm-remind-label" class={fieldLabel}>Remind me at</span>
								<Select.Root type="single" bind:value={remindHour} items={HOURS}>
									<Select.Trigger
										data-no-press
										class="{input} flex items-center gap-2 border px-3 py-2 text-left"
										aria-labelledby="pm-remind-label"
									>
										<Bell class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
										<span>{hourLabel(Number(remindHour))}</span>
										<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
									</Select.Trigger>
									<Select.Portal>
										<Select.Content sideOffset={4} class={selectContent}>
											<Select.Viewport>
												{#each HOURS as h (h.value)}
													<Select.Item value={h.value} label={h.label} class={selectItem}>
														{#snippet children({ selected })}
															<span>{h.label}</span>
															{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
														{/snippet}
													</Select.Item>
												{/each}
											</Select.Viewport>
										</Select.Content>
									</Select.Portal>
								</Select.Root>
								<p class={hint}>
									The day before and the day it’s due. Next: {short(
										nextOnDay(today, due.day).subtract({ days: 1 })
									)} and {short(nextOnDay(today, due.day))}.
								</p>
							</div>
						{/if}
					</div>
				{/if}

				<div class="flex items-center gap-2">
					{#if editing}
						<button
							type="button"
							onclick={remove}
							class="mr-auto rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
						>
							Remove
						</button>
					{/if}
					<Dialog.Close type="button" class="{secondary} {editing ? '' : 'ml-auto'}">
						Cancel
					</Dialog.Close>
					<button type="submit" class={primary}>{editing ? 'Save' : 'Add'}</button>
				</div>
				{#if editing}
					<p class="-mt-2 {hint}">Removing keeps it on expenses you already added.</p>
				{/if}
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!-- Add expense, with "Paid with" (otherwise the same as AddTransactionDialog) -->
<Dialog.Root bind:open={expenseOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content class={dialog}>
			<Dialog.Title class="text-base font-semibold">Add expense</Dialog.Title>

			<form class="mt-4 flex flex-col gap-4" onsubmit={addExpense}>
				<div
					class="grid grid-cols-2 gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
					aria-hidden="true"
				>
					<span
						class="rounded bg-gray-900 px-3 py-1.5 text-center text-sm font-medium text-white dark:bg-white dark:text-gray-900"
					>
						Expense
					</span>
					<span
						class="px-3 py-1.5 text-center text-sm font-medium text-gray-600 dark:text-gray-400"
					>
						Income
					</span>
				</div>

				<div class="flex flex-col gap-1">
					<label for="ex-name" class={fieldLabel}>Name</label>
					<input
						id="ex-name"
						bind:value={expenseName}
						autocomplete="off"
						placeholder="e.g. Trader Joe’s"
						class={input}
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="flex flex-col gap-1">
						<label for="ex-amount" class={fieldLabel}>Amount</label>
						<div class="relative">
							<span
								class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
								aria-hidden="true">$</span
							>
							<input
								id="ex-amount"
								bind:value={amount}
								inputmode="decimal"
								autocomplete="off"
								placeholder="0.00"
								class="{input} pl-7 tabular-nums"
							/>
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<span id="ex-date-label" class={fieldLabel}>Date</span>
						<DatePicker bind:value={date} labelledby="ex-date-label" />
					</div>
				</div>

				<div class="flex flex-col gap-1">
					<span id="ex-category-label" class={fieldLabel}>Category</span>
					<Select.Root
						type="single"
						bind:value={categoryId}
						items={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
					>
						<Select.Trigger
							data-no-press
							class="{input} flex items-center gap-2 border px-3 py-2 text-left"
							aria-labelledby="ex-category-label"
						>
							{#if selectedCategory}
								{@const Icon = categoryIcon(selectedCategory.icon)}
								<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
								<span class="truncate">{selectedCategory.name}</span>
							{/if}
							<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
						</Select.Trigger>
						<Select.Portal>
							<Select.Content sideOffset={4} class={selectContent}>
								<Select.Viewport>
									{#each CATEGORIES as c (c.id)}
										{@const Icon = categoryIcon(c.icon)}
										<Select.Item value={c.id} label={c.name} class={selectItem}>
											{#snippet children({ selected })}
												<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
												<span class="truncate">{c.name}</span>
												{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
				</div>

				<!-- New: Paid with -->
				<div class="flex flex-col gap-1">
					<span id="ex-paid-label" class={fieldLabel}>
						Paid with <span class={optional}>(optional)</span>
					</span>
					<Select.Root
						type="single"
						bind:value={paidWith}
						items={[
							{ value: '', label: 'Not recorded' },
							...paidWithOptions.map((m) => ({ value: m.id, label: m.name }))
						]}
					>
						<Select.Trigger
							data-no-press
							class="{input} flex items-center gap-2 border px-3 py-2 text-left"
							aria-labelledby="ex-paid-label"
						>
							{#if selectedMethod}
								{@const Icon = KIND[selectedMethod.kind].icon}
								<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
								<span class="truncate">{selectedMethod.name}</span>
								{#if selectedMethod.last4}
									<span class="text-gray-500 tabular-nums">•• {selectedMethod.last4}</span>
								{/if}
							{:else}
								<span class="text-gray-400">Not recorded</span>
							{/if}
							<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
						</Select.Trigger>
						<Select.Portal>
							<Select.Content sideOffset={4} class={selectContent}>
								<Select.Viewport>
									<Select.Item value="" label="Not recorded" class={selectItem}>
										{#snippet children({ selected })}
											<span class="text-gray-500">Not recorded</span>
											{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
										{/snippet}
									</Select.Item>
									{#each paidWithOptions as m (m.id)}
										{@const Icon = KIND[m.kind].icon}
										<Select.Item value={m.id} label={m.name} class={selectItem}>
											{#snippet children({ selected })}
												<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
												<span class="truncate">{m.name}</span>
												{#if m.last4}
													<span class="text-xs text-gray-500 tabular-nums">•• {m.last4}</span>
												{/if}
												{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
					{#if statementNote}<p class={hint}>{statementNote}</p>{/if}
				</div>

				<div class="flex flex-col gap-1">
					<label for="ex-notes" class={fieldLabel}>
						Notes <span class={optional}>(optional)</span>
					</label>
					<textarea id="ex-notes" rows="2" class={input}></textarea>
				</div>

				<div class="flex justify-end gap-2">
					<Dialog.Close type="button" class={secondary}>Cancel</Dialog.Close>
					<button type="submit" class={primary}>Add expense</button>
				</div>
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
