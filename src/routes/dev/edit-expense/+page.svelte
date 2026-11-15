<!--
	Mock: editing an expense. Sample rows; saving only updates this page.

	View: "Phone" (the list) or "Desktop" (the table). Picked so far: phone = ⋯ then Edit, Dialog.
	Desktop opens the same dialog three ways: tick one row and press Edit in the bar above the
	table (shown only when exactly one row is ticked, next to Delete); double-click a row; or
	focus a row (Tab) and press Enter.

	Phone toggles:
	- Open with: "⋯ then Edit" (an Edit button next to Delete in the row's details) or
	  "Tap the row" (the row opens the form; ⋯ still shows the details).
	- Form: "Dialog" (centered, like Add today) or "Sheet" (slides up from the bottom, full
	  width, buttons in reach of a thumb, the keyboard pushes it up rather than covering it).
	The form is the add form pre-filled: name, amount, date, category, paid with, notes. No
	Expense/Income switch (an expense can't become income). Save stays off until something
	changes. Delete is in the form too. A charge made by a recurring expense says so: editing it
	changes only that one charge.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Trash from '@lucide/svelte/icons/trash';
	import { Dialog, Select } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { categoryIcon, type CategoryIconName } from '#lib/category-icons.ts';
	import DatePicker from '#lib/components/DatePicker.svelte';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import { formatDate, formatNumericDate } from '#lib/date-range.ts';
	import { Temporal, type PlainDate } from '#lib/dates.ts';
	import { formatCents } from '#lib/money.ts';
	import { last4Label, type PaymentMethodKind } from '#lib/payment-methods.ts';
	import { parseAmount } from '#lib/transaction-input.ts';

	type Category = { id: string; name: string; icon: CategoryIconName };
	const CATEGORIES: Category[] = [
		{ id: 'groceries', name: 'Groceries', icon: 'shopping-cart' },
		{ id: 'eating', name: 'Eating out', icon: 'utensils-crossed' },
		{ id: 'rent', name: 'Rent', icon: 'house' },
		{ id: 'gas', name: 'Gas', icon: 'fuel' }
	];
	type Method = { id: string; kind: PaymentMethodKind; name: string; last4: string | null };
	const METHODS: Method[] = [
		{ id: 'chase', kind: 'credit', name: 'Chase Sapphire', last4: '4821' },
		{ id: 'checking', kind: 'debit', name: 'Checking', last4: '5532' },
		{ id: 'venmo', kind: 'p2p', name: 'Venmo', last4: null },
		{ id: 'cash', kind: 'cash', name: 'Cash', last4: null }
	];

	type Row = {
		id: string;
		name: string;
		cents: number;
		date: PlainDate;
		categoryId: string;
		methodId: string;
		notes: string;
		recurring: string | null;
	};
	const today = Temporal.Now.plainDateISO();
	let rows = $state<Row[]>([
		{
			id: '1',
			name: 'Trader Joe’s',
			cents: 6412,
			date: today,
			categoryId: 'groceries',
			methodId: 'chase',
			notes: '',
			recurring: null
		},
		{
			id: '2',
			name: 'Dinner with Sam',
			cents: 3800,
			date: today.subtract({ days: 1 }),
			categoryId: 'eating',
			methodId: 'venmo',
			notes: 'Split, paid back',
			recurring: null
		},
		{
			id: '3',
			name: 'Gas',
			cents: 4820,
			date: today.subtract({ days: 3 }),
			categoryId: 'gas',
			methodId: 'checking',
			notes: '',
			recurring: null
		},
		{
			id: '4',
			name: 'Rent',
			cents: 180000,
			date: today.with({ day: 1 }),
			categoryId: 'rent',
			methodId: '',
			notes: '',
			recurring: 'Rent'
		}
	]);

	type OpenWith = 'details' | 'row';
	type Form = 'dialog' | 'sheet';
	type View = 'phone' | 'desktop';
	let view = $state<View>('phone');
	let openWith = $state<OpenWith>('details');
	let form = $state<Form>('dialog');
	// The desktop table always uses the dialog.
	const formShown = $derived<Form>(view === 'desktop' ? 'dialog' : form);
	let ticked = $state<string[]>([]);
	const toggleTick = (id: string) =>
		(ticked = ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id]);
	const tickedRow = $derived(
		ticked.length === 1 ? rows.find((r) => r.id === ticked[0]) : undefined
	);

	let expanded = $state<string | null>('2');

	// --- Edit form ---
	let open = $state(false);
	let editing = $state<Row | null>(null);
	let name = $state('');
	let amount = $state('');
	let date = $state<PlainDate | null>(null);
	let categoryId = $state('');
	let methodId = $state('');
	let notes = $state('');
	let confirmDelete = $state(false);

	function edit(row: Row) {
		editing = row;
		name = row.name;
		amount = (row.cents / 100).toFixed(2);
		date = row.date;
		categoryId = row.categoryId;
		methodId = row.methodId;
		notes = row.notes;
		confirmDelete = false;
		open = true;
	}

	const cents = $derived(parseAmount(amount));
	const changed = $derived(
		editing !== null &&
			(name.trim() !== editing.name ||
				cents !== editing.cents ||
				!date?.equals(editing.date) ||
				categoryId !== editing.categoryId ||
				methodId !== editing.methodId ||
				notes.trim() !== editing.notes)
	);
	const valid = $derived(Boolean(name.trim()) && cents !== null && date !== null);

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!editing || !changed || !valid || cents === null || !date) return;
		const id = editing.id;
		const newDate = date;
		const newCents = cents;
		rows = rows.map((r) =>
			r.id === id
				? {
						...r,
						name: name.trim(),
						cents: newCents,
						date: newDate,
						categoryId,
						methodId,
						notes: notes.trim()
					}
				: r
		);
		open = false;
		toast.success('Saved changes.');
	}

	function remove() {
		if (!editing) return;
		const id = editing.id;
		rows = rows.filter((r) => r.id !== id);
		ticked = ticked.filter((x) => x !== id);
		open = false;
		toast.success(`Deleted “${editing.name}”.`);
	}

	const selectedCategory = $derived(CATEGORIES.find((c) => c.id === categoryId));
	const selectedMethod = $derived(METHODS.find((m) => m.id === methodId));
	// The sheet slides up from the bottom; the dialog drops in slightly. Still for Reduce Motion.
	function formIn(node: Element) {
		if (prefersReducedMotion.current) return { duration: 0 };
		return formShown === 'sheet'
			? fly(node, { y: 400, duration: 280, easing: cubicOut })
			: fly(node, { y: 8, duration: 150, easing: cubicOut });
	}

	const gridTemplate = '2.25rem 8.5rem minmax(12rem,1.5fr) 11rem 13rem 7.5rem minmax(10rem,2fr)';
	const cell = 'flex items-center truncate border-r border-gray-200 px-2 dark:border-gray-800';
	const toggleBtn =
		'rounded-md border border-gray-300 px-2.5 py-1 text-xs aria-pressed:bg-gray-900 aria-pressed:text-white dark:border-gray-700 dark:aria-pressed:bg-white dark:aria-pressed:text-gray-900';
	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-sm font-medium';
	const selectContent =
		'z-[60] max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900';
	const selectItem =
		'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800';
	const dialogClass =
		'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const sheetClass =
		'fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-b-0 border-gray-200 bg-white px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-gray-900 shadow-2xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
</script>

<svelte:head>
	<title>Edit expense mock</title>
</svelte:head>

<!-- Mock controls (not part of the page) -->
<div
	class="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-dashed border-gray-300 bg-gray-50/90 px-4 py-2 text-xs backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"
>
	<span class="font-medium text-gray-500">View:</span>
	<button
		type="button"
		class={toggleBtn}
		aria-pressed={view === 'phone'}
		onclick={() => (view = 'phone')}>Phone</button
	>
	<button
		type="button"
		class={toggleBtn}
		aria-pressed={view === 'desktop'}
		onclick={() => (view = 'desktop')}>Desktop</button
	>
	{#if view === 'phone'}
		<span class="ml-2 font-medium text-gray-500">Open with:</span>
		<button
			type="button"
			class={toggleBtn}
			aria-pressed={openWith === 'details'}
			onclick={() => (openWith = 'details')}>⋯ then Edit</button
		>
		<button
			type="button"
			class={toggleBtn}
			aria-pressed={openWith === 'row'}
			onclick={() => (openWith = 'row')}>Tap the row</button
		>
		<span class="ml-2 font-medium text-gray-500">Form:</span>
		<button
			type="button"
			class={toggleBtn}
			aria-pressed={form === 'dialog'}
			onclick={() => (form = 'dialog')}>Dialog</button
		>
		<button
			type="button"
			class={toggleBtn}
			aria-pressed={form === 'sheet'}
			onclick={() => (form = 'sheet')}>Sheet</button
		>
	{/if}
</div>

{#snippet summary(row: Row)}
	{@const cat = CATEGORIES.find((c) => c.id === row.categoryId)}
	{@const Icon = categoryIcon(cat?.icon)}
	{@const method = METHODS.find((m) => m.id === row.methodId)}
	<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
	<span class="shrink-0 text-xs text-gray-500 tabular-nums">
		{formatNumericDate(row.date)}
	</span>
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="truncate">{row.name}</span>
		{#if method}
			<span class="flex items-center gap-1 text-xs text-gray-500">
				<PaymentMethodIcon kind={method.kind} class="size-3 shrink-0" />
				<span class="truncate">{method.name} {last4Label(method.last4)}</span>
			</span>
		{/if}
	</span>
	<span class="shrink-0 font-medium tabular-nums">{formatCents(row.cents)}</span>
{/snippet}

<main
	class={['mx-auto flex flex-col gap-3 p-4', view === 'phone' ? 'max-w-93.75' : 'max-w-6xl sm:p-6']}
>
	<h1 class="text-2xl font-semibold">Transactions</h1>
	{#if view === 'phone'}
		<p class="text-xs text-gray-500">
			{openWith === 'details'
				? 'Tap ⋯ on a row, then Edit.'
				: 'Tap a row to edit it. ⋯ still shows the details.'}
		</p>

		<ul class="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
			{#each rows as row, i (row.id)}
				{@const cat = CATEGORIES.find((c) => c.id === row.categoryId)}
				{@const method = METHODS.find((m) => m.id === row.methodId)}
				{@const isOpen = expanded === row.id}
				<li class={['border-gray-100 dark:border-gray-800', i < rows.length - 1 && 'border-b']}>
					<div class="flex items-center gap-2 py-2 pr-1 pl-3 text-sm">
						{#if openWith === 'row'}
							<button
								type="button"
								onclick={() => edit(row)}
								data-no-press
								class="flex min-w-0 flex-1 items-center gap-2 text-left"
								aria-label="Edit {row.name}"
							>
								{@render summary(row)}
							</button>
						{:else}
							<div class="flex min-w-0 flex-1 items-center gap-2">{@render summary(row)}</div>
						{/if}
						<button
							type="button"
							class="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 aria-expanded:bg-gray-100 dark:hover:bg-gray-800 dark:aria-expanded:bg-gray-800"
							aria-expanded={isOpen}
							aria-label="{isOpen ? 'Hide' : 'Show'} details for {row.name}"
							onclick={() => (expanded = isOpen ? null : row.id)}
						>
							<Ellipsis class="size-4" aria-hidden="true" />
						</button>
					</div>
					{#if isOpen}
						<div class="bg-gray-50 dark:bg-gray-900">
							<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 pt-2 text-xs">
								<dt class="text-gray-500">Category</dt>
								<dd>{cat?.name}</dd>
								<dt class="text-gray-500">Paid with</dt>
								<dd class={method ? '' : 'text-gray-400 italic'}>
									{method ? `${method.name} ${last4Label(method.last4)}` : 'Not recorded'}
								</dd>
								<dt class="text-gray-500">Notes</dt>
								<dd class={row.notes ? '' : 'text-gray-400 italic'}>{row.notes || 'No notes'}</dd>
							</dl>
							<div class="flex justify-end gap-1 px-1 pb-1">
								{#if openWith === 'details'}
									<button
										type="button"
										onclick={() => edit(row)}
										class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
									>
										<Pencil class="size-3.5" aria-hidden="true" />
										Edit
									</button>
								{/if}
								<span
									class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-red-700 dark:text-red-400"
								>
									<Trash class="size-3.5" aria-hidden="true" />
									Delete
								</span>
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<!-- Bar above the table: a hint, or what to do with the ticked rows. -->
		<div class="flex min-h-9 flex-wrap items-center gap-2 text-sm">
			{#if ticked.length === 0}
				<span class="text-xs text-gray-500 dark:text-gray-400">
					Tick a row to edit or delete it. Double-click a row, or press Enter on it, to edit.
				</span>
			{:else}
				<span class="font-medium">{ticked.length} selected</span>
				{#if tickedRow}
					<button
						type="button"
						onclick={() => tickedRow && edit(tickedRow)}
						class="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
					>
						<Pencil class="size-4" aria-hidden="true" />
						Edit
					</button>
				{/if}
				<span
					class="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white"
				>
					<Trash class="size-4" aria-hidden="true" />
					Delete
				</span>
				<button
					type="button"
					onclick={() => (ticked = [])}
					class="rounded-md px-2 py-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					Clear
				</button>
			{/if}
		</div>

		<div
			class="overflow-auto rounded-md border border-gray-200 text-sm dark:border-gray-800"
			role="table"
			aria-label="Expenses"
		>
			<div class="min-w-240">
				<div
					role="row"
					class="grid border-b border-gray-200 bg-gray-50 text-xs dark:border-gray-800 dark:bg-gray-900"
					style:grid-template-columns={gridTemplate}
				>
					<div role="columnheader" class="border-r border-gray-200 dark:border-gray-800">
						<span class="sr-only">Select</span>
					</div>
					{#each ['Date', 'Name', 'Category', 'Paid with', 'Amount', 'Notes'] as h (h)}
						<div
							role="columnheader"
							class={[
								'flex h-9 items-center border-r border-gray-200 px-2 font-medium last:border-r-0 dark:border-gray-800',
								h === 'Amount' && 'justify-end'
							]}
						>
							{h}
						</div>
					{/each}
				</div>
				{#each rows as row, i (row.id)}
					{@const cat = CATEGORIES.find((c) => c.id === row.categoryId)}
					{@const Icon = categoryIcon(cat?.icon)}
					{@const method = METHODS.find((m) => m.id === row.methodId)}
					{@const isTicked = ticked.includes(row.id)}
					<div
						role="row"
						tabindex="0"
						aria-selected={isTicked}
						ondblclick={() => edit(row)}
						onkeydown={(e) => {
							if (e.key === 'Enter' && e.target === e.currentTarget) edit(row);
						}}
						title="Double-click to edit"
						class={[
							'grid h-8 cursor-default border-gray-100 outline-none select-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-inset dark:border-gray-800/60',
							i < rows.length - 1 && 'border-b',
							isTicked
								? 'bg-blue-50 dark:bg-blue-950/60'
								: 'bg-white hover:bg-gray-50 dark:bg-gray-950 dark:hover:bg-gray-900'
						]}
						style:grid-template-columns={gridTemplate}
					>
						<div role="cell" class="{cell} justify-center px-0">
							<input
								type="checkbox"
								class="size-4 cursor-pointer rounded border-gray-300 text-gray-900 dark:border-gray-600 dark:bg-gray-900"
								checked={isTicked}
								onchange={() => toggleTick(row.id)}
								ondblclick={(e) => e.stopPropagation()}
								aria-label="Select {row.name}"
							/>
						</div>
						<div role="cell" class="{cell} tabular-nums">{formatDate(row.date)}</div>
						<div role="cell" class={cell}><span class="truncate">{row.name}</span></div>
						<div role="cell" class="{cell} gap-2">
							<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
							<span class="truncate">{cat?.name}</span>
						</div>
						<div role="cell" class="{cell} gap-2">
							{#if method}
								<PaymentMethodIcon kind={method.kind} class="size-4 shrink-0 text-gray-500" />
								<span class="truncate">{method.name}</span>
								{#if method.last4}
									<span class="shrink-0 text-xs text-gray-500">{last4Label(method.last4)}</span>
								{/if}
							{:else}
								<span class="font-mono text-xs text-gray-300 italic dark:text-gray-600">NULL</span>
							{/if}
						</div>
						<div role="cell" class="{cell} justify-end tabular-nums">{formatCents(row.cents)}</div>
						<div role="cell" class="{cell} border-r-0">
							{#if row.notes}
								<span class="truncate text-gray-600 dark:text-gray-400">{row.notes}</span>
							{:else}
								<span class="font-mono text-xs text-gray-300 italic dark:text-gray-600">NULL</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content forceMount class={formShown === 'sheet' ? sheetClass : dialogClass}>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div {...props} transition:formIn>
						{#if formShown === 'sheet'}
							<div class="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700"></div>
						{/if}
						<Dialog.Title class="text-base font-semibold">Edit expense</Dialog.Title>

						{#if editing?.recurring}
							<p
								class="mt-3 flex items-start gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300"
							>
								<Repeat class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
								<span>
									Added by your recurring “{editing.recurring}”. Changes here only affect this
									charge, not future ones.
								</span>
							</p>
						{/if}

						<form class="mt-4 flex flex-col gap-4" onsubmit={save}>
							<div class="flex flex-col gap-1">
								<label for="ed-name" class={fieldLabel}>Name</label>
								<input id="ed-name" bind:value={name} autocomplete="off" class={input} />
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div class="flex flex-col gap-1">
									<label for="ed-amount" class={fieldLabel}>Amount</label>
									<div class="relative">
										<span
											class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
											aria-hidden="true">$</span
										>
										<input
											id="ed-amount"
											bind:value={amount}
											inputmode="decimal"
											autocomplete="off"
											class="{input} pl-7 tabular-nums"
										/>
									</div>
								</div>
								<div class="flex flex-col gap-1">
									<span id="ed-date-label" class={fieldLabel}>Date</span>
									<DatePicker bind:value={date} labelledby="ed-date-label" />
								</div>
							</div>

							<div class="flex flex-col gap-1">
								<span id="ed-cat-label" class={fieldLabel}>Category</span>
								<Select.Root
									type="single"
									bind:value={categoryId}
									items={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
								>
									<Select.Trigger
										data-no-press
										class="{input} flex items-center gap-2 border px-3 py-2 text-left"
										aria-labelledby="ed-cat-label"
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

							<div class="flex flex-col gap-1">
								<span id="ed-paid-label" class={fieldLabel}>
									Paid with <span class="font-normal text-gray-500">(optional)</span>
								</span>
								<Select.Root
									type="single"
									bind:value={methodId}
									items={[
										{ value: '', label: 'Not recorded' },
										...METHODS.map((m) => ({ value: m.id, label: m.name }))
									]}
								>
									<Select.Trigger
										data-no-press
										class="{input} flex items-center gap-2 border px-3 py-2 text-left"
										aria-labelledby="ed-paid-label"
									>
										{#if selectedMethod}
											<PaymentMethodIcon
												kind={selectedMethod.kind}
												class="size-4 shrink-0 text-gray-500"
											/>
											<span class="truncate">{selectedMethod.name}</span>
										{:else}
											<span class="text-gray-400">Not recorded</span>
										{/if}
										<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
									</Select.Trigger>
									<Select.Portal>
										<Select.Content sideOffset={4} class={selectContent}>
											<Select.Viewport>
												<Select.Item value="" label="Not recorded" class={selectItem}>
													<span class="text-gray-500">Not recorded</span>
												</Select.Item>
												{#each METHODS as m (m.id)}
													<Select.Item value={m.id} label={m.name} class={selectItem}>
														{#snippet children({ selected })}
															<PaymentMethodIcon
																kind={m.kind}
																class="size-4 shrink-0 text-gray-500"
															/>
															<span class="truncate">{m.name}</span>
															{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
														{/snippet}
													</Select.Item>
												{/each}
											</Select.Viewport>
										</Select.Content>
									</Select.Portal>
								</Select.Root>
							</div>

							<div class="flex flex-col gap-1">
								<label for="ed-notes" class={fieldLabel}>
									Notes <span class="font-normal text-gray-500">(optional)</span>
								</label>
								<textarea id="ed-notes" bind:value={notes} rows="2" class={input}></textarea>
							</div>

							{#if confirmDelete}
								<div
									class="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
								>
									<p>Delete <strong>{editing?.name}</strong>? This can’t be undone.</p>
									<div class="flex justify-end gap-2">
										<button
											type="button"
											onclick={() => (confirmDelete = false)}
											class="rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700"
										>
											Keep
										</button>
										<button
											type="button"
											onclick={remove}
											class="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white"
										>
											Delete
										</button>
									</div>
								</div>
							{:else}
								<div class={['flex items-center gap-2', formShown === 'sheet' && 'pt-1']}>
									<button
										type="button"
										onclick={() => (confirmDelete = true)}
										class="mr-auto rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
									>
										Delete
									</button>
									<Dialog.Close
										type="button"
										class={[
											'rounded-md border border-gray-300 px-3 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
											formShown === 'sheet' ? 'py-2.5' : 'py-1.5'
										]}
									>
										Cancel
									</Dialog.Close>
									<button
										type="submit"
										disabled={!changed || !valid}
										class={[
											'rounded-md bg-gray-900 px-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200',
											formShown === 'sheet' ? 'py-2.5' : 'py-1.5'
										]}
									>
										Save
									</button>
								</div>
							{/if}
						</form>
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
