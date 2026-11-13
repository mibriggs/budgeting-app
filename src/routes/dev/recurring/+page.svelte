<!--
	MOCK (delete before shipping): Settings → Recurring. Fake data, nothing is stored; Save just
	updates the page. A list of recurring expenses (next charge, schedule, rough monthly total)
	and an add/edit dialog with one or more cadences, an optional end date and a live preview.
-->
<script lang="ts">
	import { Dialog, Select, Switch } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Tags from '@lucide/svelte/icons/tags';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Wallet from '@lucide/svelte/icons/wallet';
	import Bell from '@lucide/svelte/icons/bell';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import DatePicker from '#lib/components/DatePicker.svelte';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { Temporal, today as todayIn, type PlainDate } from '#lib/dates.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import { parseAmount } from '#lib/transaction-input.ts';
	import {
		INTERVAL_UNITS,
		MAX_INTERVAL,
		chargesPerMonth,
		clampsInShortMonths,
		describeSchedule,
		ordinal,
		unitLabel,
		upcoming,
		type Cadence,
		type IntervalUnit
	} from '#lib/recurring-schedule.ts';

	const today = todayIn();
	// Reminders go out on the hour (a job checks once an hour; see future-plans), default noon.
	const DEFAULT_REMIND_HOUR = 12;
	function hourLabel(h: number): string {
		if (h === 0) return '12 AM (midnight)';
		if (h === 12) return '12 PM (noon)';
		return `${h % 12} ${h < 12 ? 'AM' : 'PM'}`;
	}
	const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }));
	// Start and end dates can be up to 10 years either side of today.
	const DATE_MIN = today.subtract({ years: 10 }).with({ month: 1, day: 1 });
	const DATE_MAX = today.add({ years: 10 }).with({ month: 12, day: 31 });
	const d = (s: string) => Temporal.PlainDate.from(s);

	const categories = [
		{ id: 'rent', name: 'Rent', icon: 'house' },
		{ id: 'utilities', name: 'Utilities', icon: 'zap' },
		{ id: 'transport', name: 'Transportation', icon: 'car' },
		{ id: 'wellness', name: 'Wellness', icon: 'dumbbell' },
		{ id: 'subs', name: 'Subscriptions', icon: 'repeat' },
		{ id: 'housing', name: 'Housing', icon: 'sofa' },
		{ id: 'tech', name: 'Technology', icon: 'laptop' }
	];
	const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

	type Item = {
		id: string;
		name: string;
		amountCents: number;
		categoryId: string;
		cadences: Cadence[];
		endDate: PlainDate | null;
		paused: boolean;
		notes: string;
		/** Hour of the day (0–23, the user's time zone) the reminders are sent. */
		remindHour: number;
	};

	const monthStart = today.with({ day: 1 });
	let n = 0;
	const item = (
		i: Omit<Item, 'id' | 'paused' | 'notes' | 'endDate' | 'remindHour'> & Partial<Item>
	): Item => ({
		id: `r${++n}`,
		paused: false,
		notes: '',
		endDate: null,
		remindHour: DEFAULT_REMIND_HOUR,
		...i
	});

	let items = $state<Item[]>([
		item({
			name: 'Rent',
			amountCents: 185500,
			categoryId: 'rent',
			cadences: [{ startDate: monthStart.subtract({ months: 8 }), count: 1, unit: 'month' }]
		}),
		item({
			name: 'Netflix',
			amountCents: 1549,
			categoryId: 'subs',
			cadences: [{ startDate: monthStart.with({ day: 12 }), count: 1, unit: 'month' }]
		}),
		item({
			name: 'Personal trainer',
			amountCents: 4000,
			categoryId: 'wellness',
			cadences: [
				{ startDate: monthStart.subtract({ months: 2 }), count: 1, unit: 'month' },
				{ startDate: monthStart.subtract({ months: 2 }).with({ day: 15 }), count: 1, unit: 'month' }
			]
		}),
		item({
			name: 'Cleaner',
			amountCents: 9000,
			categoryId: 'housing',
			cadences: [{ startDate: today.subtract({ days: 12 }), count: 2, unit: 'week' }]
		}),
		item({
			name: 'Car insurance',
			amountCents: 61200,
			categoryId: 'transport',
			cadences: [{ startDate: d('2026-03-20'), count: 6, unit: 'month' }]
		}),
		item({
			name: 'Phone',
			amountCents: 6500,
			categoryId: 'utilities',
			cadences: [{ startDate: d('2026-01-31'), count: 1, unit: 'month' }]
		}),
		item({
			name: 'Amazon Prime',
			amountCents: 13900,
			categoryId: 'subs',
			cadences: [{ startDate: d('2026-02-03'), count: 1, unit: 'year' }]
		}),
		item({
			name: 'Domain renewal',
			amountCents: 1200,
			categoryId: 'tech',
			cadences: [{ startDate: d('2025-07-09'), count: 1, unit: 'year' }],
			paused: true
		})
	]);

	const nextOf = (i: Item) => upcoming(i.cadences, today, 1, i.endDate)[0]?.date ?? null;
	const monthlyCents = (i: Item) =>
		Math.round(i.cadences.reduce((s, c) => s + chargesPerMonth(c), 0) * i.amountCents);

	// Active ones by next charge; paused and finished ones after.
	const rows = $derived(
		items
			.map((i) => ({ ...i, next: i.paused ? null : nextOf(i) }))
			.sort((a, b) => {
				if (!a.next || !b.next) return a.next ? -1 : b.next ? 1 : a.name.localeCompare(b.name);
				return Temporal.PlainDate.compare(a.next, b.next) || a.name.localeCompare(b.name);
			})
	);
	const active = $derived(rows.filter((r) => r.next));
	const totalMonthly = $derived(active.reduce((s, r) => s + monthlyCents(r), 0));

	function whenLabel(date: PlainDate): string {
		const days = today.until(date).days;
		if (days === 0) return 'Today';
		if (days === 1) return 'Tomorrow';
		if (days < 7) return date.toLocaleString('en-US', { weekday: 'long' });
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.year === today.year ? undefined : 'numeric'
		});
	}
	const short = (date: PlainDate) =>
		date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: date.year === today.year ? undefined : 'numeric'
		});

	// ---------------------------------------------------------------------------
	// Add / edit dialog

	type CadenceDraft = { key: number; start: PlainDate | null; count: number; unit: IntervalUnit };
	type Form = {
		id: string | null;
		name: string;
		amount: string;
		categoryId: string;
		cadences: CadenceDraft[];
		hasEnd: boolean;
		end: PlainDate | null;
		paused: boolean;
		notes: string;
		/** Bits Select works with strings, so the hour is kept as one here. */
		remindHour: string;
	};

	let open = $state(false);
	let confirmDelete = $state(false);
	let submitted = $state(false);
	let key = 0;
	const blankCadence = (): CadenceDraft => ({
		key: ++key,
		start: today,
		count: 1,
		unit: 'month'
	});
	let form = $state<Form>({
		id: null,
		name: '',
		amount: '',
		categoryId: '',
		cadences: [blankCadence()],
		hasEnd: false,
		end: null,
		paused: false,
		notes: '',
		remindHour: String(DEFAULT_REMIND_HOUR)
	});

	function openAdd() {
		form = {
			id: null,
			name: '',
			amount: '',
			categoryId: '',
			cadences: [blankCadence()],
			hasEnd: false,
			end: null,
			paused: false,
			notes: '',
			remindHour: String(DEFAULT_REMIND_HOUR)
		};
		submitted = false;
		confirmDelete = false;
		open = true;
	}

	function openEdit(i: Item) {
		form = {
			id: i.id,
			name: i.name,
			amount: (i.amountCents / 100).toFixed(2),
			categoryId: i.categoryId,
			cadences: i.cadences.map((c) => ({
				key: ++key,
				start: c.startDate,
				count: c.count,
				unit: c.unit
			})),
			hasEnd: i.endDate !== null,
			end: i.endDate,
			paused: i.paused,
			notes: i.notes,
			remindHour: String(i.remindHour)
		};
		submitted = false;
		confirmDelete = false;
		open = true;
	}

	// The form as a schedule, when it's complete enough to preview.
	const cadences = $derived(
		form.cadences.flatMap((c) => {
			const startDate = c.start;
			return startDate && c.count >= 1 && c.count <= MAX_INTERVAL
				? [{ startDate, count: c.count, unit: c.unit }]
				: [];
		})
	);
	const endDate = $derived(form.hasEnd ? form.end : null);
	const amountCents = $derived(parseAmount(form.amount));
	const preview = $derived(
		cadences.length === form.cadences.length ? upcoming(cadences, today, 4, endDate) : []
	);
	const clamps = $derived(cadences.filter(clampsInShortMonths));

	const errors = $derived.by(() => {
		const e: Record<string, string> = {};
		if (!form.name.trim()) e.name = 'Enter a name.';
		if (amountCents === null) e.amount = 'Enter an amount like 15 or 15.49.';
		if (!form.categoryId) e.category = 'Pick a category.';
		form.cadences.forEach((c) => {
			if (!c.start) e[`start-${c.key}`] = 'Pick a start date.';
			if (!(c.count >= 1 && c.count <= MAX_INTERVAL))
				e[`count-${c.key}`] = `Use 1 to ${MAX_INTERVAL}.`;
		});
		if (form.hasEnd) {
			if (!endDate) e.end = 'Pick an end date.';
			else if (cadences.some((c) => Temporal.PlainDate.compare(endDate, c.startDate) < 0))
				e.end = 'The end date can’t be before a start date.';
		}
		return e;
	});
	const show = (k: string) => (submitted ? errors[k] : undefined);

	function save(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (Object.keys(errors).length > 0) return;
		const saved: Item = {
			id: form.id ?? `r${++n}`,
			name: form.name.trim(),
			amountCents: amountCents!,
			categoryId: form.categoryId,
			cadences,
			endDate,
			paused: form.paused,
			notes: form.notes.trim(),
			remindHour: Number(form.remindHour)
		};
		items = form.id ? items.map((i) => (i.id === form.id ? saved : i)) : [...items, saved];
		open = false;
		toast.success(form.id ? `Saved ${saved.name}.` : `Added ${saved.name}.`, {
			description: 'Mock: nothing was stored.'
		});
	}

	function remove() {
		const name = form.name;
		items = items.filter((i) => i.id !== form.id);
		open = false;
		toast.success(`Deleted ${name}.`, {
			description: 'Charges already added stay in your expenses. (Mock)'
		});
	}

	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-sm font-medium';
	const errorText = 'text-xs text-red-700 dark:text-red-400';
	const stepButton =
		'grid size-8 shrink-0 place-items-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-800';
	const selectedCategory = $derived(categoryById[form.categoryId]);
</script>

<svelte:head>
	<title>Recurring mock · Budget</title>
</svelte:head>

<AppHeader name="Mock user" />

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<div class="flex items-center gap-2">
		<h1 class="text-2xl font-semibold">Settings</h1>
		<span
			class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-500/20 dark:text-violet-200"
		>
			Mock · fake data
		</span>
	</div>

	<div class="flex flex-col gap-6 sm:flex-row sm:items-start">
		<nav aria-label="Settings" class="sm:sticky sm:top-18 sm:w-48 sm:shrink-0">
			<ul class="flex gap-1 border-b border-gray-200 sm:flex-col sm:border-0 dark:border-gray-800">
				{#each [{ label: 'Budgets', icon: Wallet }, { label: 'Recurring', icon: Repeat }, { label: 'Categories', icon: Tags }] as s (s.label)}
					{@const current = s.label === 'Recurring'}
					<li>
						<span
							aria-current={current ? 'page' : undefined}
							class={[
								'-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium sm:mb-0 sm:rounded-md sm:border-b-0',
								current
									? 'border-gray-900 text-gray-900 sm:bg-gray-100 dark:border-white dark:text-white dark:sm:bg-gray-800'
									: 'border-transparent text-gray-600 dark:text-gray-400'
							]}
						>
							<s.icon class="size-4" aria-hidden="true" />
							{s.label}
						</span>
					</li>
				{/each}
			</ul>
		</nav>

		<section aria-labelledby="section-title" class="min-w-0 flex-1">
			<div class="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 id="section-title" class="text-lg font-semibold">Recurring</h2>
					<p class="text-sm text-gray-500 dark:text-gray-400">
						Expenses that repeat, like rent or subscriptions. Each one is added to your expenses on
						the day it’s due.
					</p>
				</div>
				<button
					type="button"
					onclick={openAdd}
					class="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				>
					<Plus class="size-4" aria-hidden="true" />
					Add recurring
				</button>
			</div>

			<p class="mt-3 text-sm tabular-nums">
				<span class="text-gray-500 dark:text-gray-400">About</span>
				<span class="font-semibold">{formatCentsWhole(totalMonthly)}</span>
				<span class="text-gray-500 dark:text-gray-400">
					a month · {active.length} active
				</span>
			</p>

			{#if rows.length === 0}
				<p
					class="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
				>
					Nothing recurring yet. Add rent, subscriptions or anything else that repeats.
				</p>
			{:else}
				<ul
					class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
				>
					{#each rows as r (r.id)}
						{@const category = categoryById[r.categoryId]}
						{@const Icon = categoryIcon(category?.icon)}
						{@const soon = r.next && today.until(r.next).days <= 1}
						<li>
							<button
								type="button"
								onclick={() => openEdit(r)}
								class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
								data-no-press
							>
								<span
									class={[
										'grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800',
										!r.next && 'opacity-50'
									]}
								>
									<Icon class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
								</span>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class={['truncate text-sm font-medium', !r.next && 'text-gray-500']}>
										{r.name}
									</span>
									<span class="truncate text-xs text-gray-500 dark:text-gray-400">
										{describeSchedule(r.cadences)}{#if r.endDate}
											· until {short(r.endDate)}{/if}
									</span>
								</span>
								<span class="flex shrink-0 flex-col items-end">
									<span class={['text-sm tabular-nums', !r.next && 'text-gray-500']}>
										{formatCents(r.amountCents)}
									</span>
									{#if r.paused}
										<span
											class="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
										>
											Paused
										</span>
									{:else if r.next}
										<span
											class={[
												'text-xs',
												soon
													? 'font-medium text-gray-900 dark:text-gray-100'
													: 'text-gray-500 dark:text-gray-400'
											]}
										>
											{whenLabel(r.next)}
										</span>
									{:else}
										<span class="text-xs text-gray-500">Ended</span>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<p class="mt-3 flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
				<Bell class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
				Reminders the day before and the day of, at the time you pick, will come once notifications are
				set up.
			</p>
		</section>
	</div>
</main>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<Dialog.Title class="text-base font-semibold">
				{form.id ? 'Edit recurring expense' : 'Add recurring expense'}
			</Dialog.Title>

			<form class="mt-4 flex flex-col gap-4" onsubmit={save} novalidate>
				<div class="flex flex-col gap-1">
					<label for="r-name" class={fieldLabel}>Name</label>
					<input
						id="r-name"
						bind:value={form.name}
						autocomplete="off"
						placeholder="e.g. Rent"
						class={input}
						aria-invalid={show('name') ? true : undefined}
					/>
					{#if show('name')}<p class={errorText}>{show('name')}</p>{/if}
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div class="flex flex-col gap-1">
						<label for="r-amount" class={fieldLabel}>Amount</label>
						<div class="relative">
							<span
								class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
								aria-hidden="true">$</span
							>
							<input
								id="r-amount"
								bind:value={form.amount}
								inputmode="decimal"
								autocomplete="off"
								placeholder="0.00"
								class="{input} pl-7 tabular-nums"
								aria-invalid={show('amount') ? true : undefined}
							/>
						</div>
						{#if show('amount')}<p class={errorText}>{show('amount')}</p>{/if}
					</div>

					<div class="flex flex-col gap-1">
						<span id="r-category-label" class={fieldLabel}>Category</span>
						<Select.Root
							type="single"
							bind:value={form.categoryId}
							items={categories.map((c) => ({ value: c.id, label: c.name }))}
						>
							<Select.Trigger
								class="{input} flex items-center gap-2 border px-3 py-2 text-left"
								aria-labelledby="r-category-label"
								aria-invalid={show('category') ? true : undefined}
							>
								{#if selectedCategory}
									{@const Icon = categoryIcon(selectedCategory.icon)}
									<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
									<span class="truncate">{selectedCategory.name}</span>
								{:else}
									<span class="truncate text-gray-400">Pick one</span>
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
						{#if show('category')}<p class={errorText}>{show('category')}</p>{/if}
					</div>
				</div>

				<!-- Schedule: one or more cadences -->
				<fieldset class="flex flex-col gap-2">
					<legend class="{fieldLabel} mb-1">Repeats</legend>
					{#each form.cadences as c, i (c.key)}
						<div
							class="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
							role="group"
							aria-label="Cadence {i + 1}"
						>
							<div class="flex items-center gap-2">
								<span
									id="start-label-{c.key}"
									class="w-11 shrink-0 text-sm text-gray-600 dark:text-gray-400">Starts</span
								>
								<div class="min-w-0 flex-1">
									<DatePicker
										bind:value={c.start}
										labelledby="start-label-{c.key}"
										min={DATE_MIN}
										max={DATE_MAX}
										invalid={Boolean(show(`start-${c.key}`))}
										class="py-1.5"
									/>
								</div>
								{#if form.cadences.length > 1}
									<button
										type="button"
										onclick={() => (form.cadences = form.cadences.filter((x) => x !== c))}
										class="grid size-8 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-700 dark:hover:bg-gray-800 dark:hover:text-red-400"
										aria-label="Remove cadence {i + 1}"
									>
										<Trash2 class="size-4" aria-hidden="true" />
									</button>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<span
									id="every-{c.key}"
									class="w-11 shrink-0 text-sm text-gray-600 dark:text-gray-400">Every</span
								>
								<!-- Stepper: − [n] + (the number can also be typed) -->
								<div
									class="flex items-center overflow-hidden rounded-md border border-gray-300 dark:border-gray-700"
								>
									<button
										type="button"
										class={stepButton}
										disabled={c.count <= 1}
										onclick={() => (c.count = Math.max(1, c.count - 1))}
										aria-label="Fewer"
									>
										<Minus class="size-3.5" aria-hidden="true" />
									</button>
									<input
										type="number"
										inputmode="numeric"
										min="1"
										max={MAX_INTERVAL}
										bind:value={c.count}
										aria-labelledby="every-{c.key}"
										aria-invalid={show(`count-${c.key}`) ? true : undefined}
										class="w-9 [appearance:textfield] border-0 bg-transparent px-0 text-center text-sm tabular-nums focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none"
									/>
									<button
										type="button"
										class={stepButton}
										disabled={c.count >= MAX_INTERVAL}
										onclick={() => (c.count = Math.min(MAX_INTERVAL, (c.count || 0) + 1))}
										aria-label="More"
									>
										<Plus class="size-3.5" aria-hidden="true" />
									</button>
								</div>
								<select
									bind:value={c.unit}
									aria-label="Unit"
									class="{input} w-auto min-w-0 flex-1 py-1.5 pr-8 pl-2.5"
								>
									{#each INTERVAL_UNITS as unit (unit)}
										<option value={unit}>{unitLabel(unit, c.count)}</option>
									{/each}
								</select>
							</div>
							{#if show(`start-${c.key}`) || show(`count-${c.key}`)}
								<p class={errorText}>{show(`start-${c.key}`) ?? show(`count-${c.key}`)}</p>
							{/if}
						</div>
					{/each}
					<button
						type="button"
						onclick={() => form.cadences.push(blankCadence())}
						class="flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
					>
						<Plus class="size-4" aria-hidden="true" />
						Add another cadence
					</button>
				</fieldset>

				<!-- End date -->
				<div class="flex flex-col gap-1">
					<div class="flex items-center gap-2">
						<Switch.Root
							id="r-has-end"
							bind:checked={form.hasEnd}
							class="inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700"
						>
							<Switch.Thumb
								class="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-gray-900"
							/>
						</Switch.Root>
						<label for="r-has-end" class="text-sm">Ends on a date</label>
					</div>
					{#if form.hasEnd}
						<span id="r-end-label" class="sr-only">End date</span>
						<DatePicker
							bind:value={form.end}
							labelledby="r-end-label"
							min={DATE_MIN}
							max={DATE_MAX}
							invalid={Boolean(show('end'))}
							placeholder="Pick the last day"
							class="py-1.5"
						/>
						{#if show('end')}<p class={errorText}>{show('end')}</p>{/if}
					{/if}
				</div>

				<!-- Reminder time -->
				<div class="flex flex-col gap-1">
					<span id="r-remind-label" class={fieldLabel}>Reminder time</span>
					<Select.Root type="single" bind:value={form.remindHour} items={HOURS}>
						<Select.Trigger
							class="{input} flex items-center gap-2 border px-3 py-2 text-left"
							aria-labelledby="r-remind-label"
							aria-describedby="r-remind-help"
						>
							<Bell class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
							<span class="truncate">{hourLabel(Number(form.remindHour))}</span>
							<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
						</Select.Trigger>
						<Select.Portal>
							<Select.Content
								sideOffset={4}
								class="z-[60] max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
							>
								<Select.Viewport>
									{#each HOURS as hour (hour.value)}
										<Select.Item
											value={hour.value}
											label={hour.label}
											class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 tabular-nums data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800"
										>
											{#snippet children({ selected })}
												<span>{hour.label}</span>
												{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
											{/snippet}
										</Select.Item>
									{/each}
								</Select.Viewport>
							</Select.Content>
						</Select.Portal>
					</Select.Root>
					<p id="r-remind-help" class="text-xs text-gray-500 dark:text-gray-400">
						Sent the day before and the day it’s due, within about 15 minutes of this time.
					</p>
				</div>

				<!-- Preview -->
				<div
					class="rounded-lg bg-gray-50 px-3 py-2.5 text-sm dark:bg-gray-800/60"
					aria-live="polite"
				>
					{#if cadences.length === form.cadences.length && cadences.length > 0}
						<p class="text-gray-700 dark:text-gray-200">{describeSchedule(cadences)}</p>
						{#if preview.length > 0}
							<p class="mt-1 text-gray-500 dark:text-gray-400">
								Next:
								{#each preview as p, i (p.date.toString())}
									{#if i > 0}<span aria-hidden="true" class="mx-1 text-gray-400">·</span>{/if}
									<span class="whitespace-nowrap text-gray-900 dark:text-gray-100"
										>{short(p.date)}{#if p.count > 1}
											<span class="text-amber-700 dark:text-amber-300">
												(×{p.count})</span
											>{/if}</span
									>
								{/each}
							</p>
						{:else}
							<p class="mt-1 text-gray-500">No charges left before the end date.</p>
						{/if}
						{#if preview.some((p) => p.count > 1)}
							<p class="mt-1 text-xs text-gray-500">
								×2: two cadences land that day, so it’s charged twice.
							</p>
						{/if}
						{#if clamps.length > 0}
							<p class="mt-1 text-xs text-gray-500">
								{clamps[0].unit === 'year'
									? 'In years without Feb 29 it’s charged on Feb 28.'
									: `Months without the ${ordinal(clamps[0].startDate.day)} are charged on their last day.`}
							</p>
						{/if}
						{#if amountCents}
							<p class="mt-1 text-xs text-gray-500 tabular-nums">
								About {formatCentsWhole(
									Math.round(cadences.reduce((s, c) => s + chargesPerMonth(c), 0) * amountCents)
								)} a month
							</p>
						{/if}
					{:else}
						<p class="text-gray-500">Pick a start date to see the next charges.</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<label for="r-notes" class={fieldLabel}>
						Notes <span class="font-normal text-gray-500">(optional)</span>
					</label>
					<textarea id="r-notes" bind:value={form.notes} rows="2" class={input}></textarea>
				</div>

				{#if form.id}
					<div class="flex items-start gap-2 border-t border-gray-100 pt-4 dark:border-gray-800">
						<Switch.Root
							id="r-paused"
							bind:checked={form.paused}
							class="mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700"
						>
							<Switch.Thumb
								class="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-gray-900"
							/>
						</Switch.Root>
						<label for="r-paused" class="text-sm">
							Paused
							<span class="block text-xs text-gray-500 dark:text-gray-400">
								No charges or reminders while paused. Charges missed while paused aren’t added
								later.
							</span>
						</label>
					</div>
				{/if}

				<div class="flex items-center justify-between gap-2">
					{#if form.id}
						{#if confirmDelete}
							<span class="flex items-center gap-2 text-sm">
								<button
									type="button"
									onclick={remove}
									class="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
								>
									Delete
								</button>
								<button
									type="button"
									onclick={() => (confirmDelete = false)}
									class="text-sm underline"
								>
									Keep
								</button>
							</span>
						{:else}
							<button
								type="button"
								onclick={() => (confirmDelete = true)}
								class="rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
							>
								Delete…
							</button>
						{/if}
					{:else}
						<span></span>
					{/if}
					<div class="flex gap-2">
						<Dialog.Close
							type="button"
							class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
						>
							Cancel
						</Dialog.Close>
						<button
							type="submit"
							class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{form.id ? 'Save' : 'Add'}
						</button>
					</div>
				</div>
				{#if form.id && confirmDelete}
					<p class="-mt-2 text-xs text-gray-500">
						Charges already added stay in your expenses. Future ones stop.
					</p>
				{/if}
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
