<!--
	Mock: the payment method on the transactions page. Sample rows; nothing is saved.

	Phone list (today: [icon] date  Name  $amount  [⋯], details open under ⋯). Three ways to add
	"Paid with", picked with the toggle at the top:
	- Details only: a "Paid with" line in the opened details; the row itself doesn't change.
	- Under the name: a small second line ("Chase ••4821"); rows get taller.
	- Icon by amount: a small card/bank/phone/cash icon before the amount; the name is in the
	  details.
	Desktop table: a "Paid with" column after Category (icon, name, last 4; NULL when not
	recorded), sortable like the others.
	Income rows never have one.
-->
<script lang="ts">
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Trash from '@lucide/svelte/icons/trash';
	import { categoryIcon, type CategoryIconName } from '#lib/category-icons.ts';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import { formatDate, formatNumericDate } from '#lib/date-range.ts';
	import { Temporal } from '#lib/dates.ts';
	import { formatCents } from '#lib/money.ts';
	import { last4Label, type PaymentMethodKind } from '#lib/payment-methods.ts';

	type Method = { kind: PaymentMethodKind; name: string; last4: string | null };
	const CHASE: Method = { kind: 'credit', name: 'Chase Sapphire', last4: '4821' };
	const AMEX: Method = { kind: 'credit', name: 'Amex Gold', last4: '1007' };
	const DEBIT: Method = { kind: 'debit', name: 'Checking', last4: '5532' };
	const VENMO: Method = { kind: 'p2p', name: 'Venmo', last4: null };
	const CASH: Method = { kind: 'cash', name: 'Cash', last4: null };

	const today = Temporal.Now.plainDateISO();
	const ROWS: {
		id: string;
		daysAgo: number;
		name: string;
		category: string;
		icon: CategoryIconName;
		cents: number;
		notes: string | null;
		paid: Method | null;
	}[] = [
		{
			id: '1',
			daysAgo: 0,
			name: 'Trader Joe’s',
			category: 'Groceries',
			icon: 'shopping-cart',
			cents: 6412,
			notes: null,
			paid: CHASE
		},
		{
			id: '2',
			daysAgo: 0,
			name: 'Coffee',
			category: 'Eating out',
			icon: 'coffee',
			cents: 575,
			notes: null,
			paid: CASH
		},
		{
			id: '3',
			daysAgo: 1,
			name: 'Dinner with Sam',
			category: 'Eating out',
			icon: 'utensils-crossed',
			cents: 3800,
			notes: 'Split, paid back',
			paid: VENMO
		},
		{
			id: '4',
			daysAgo: 2,
			name: 'Spotify',
			category: 'Subscriptions',
			icon: 'repeat',
			cents: 1199,
			notes: null,
			paid: AMEX
		},
		{
			id: '5',
			daysAgo: 3,
			name: 'A very long purchase name that should truncate on phones',
			category: 'Shopping',
			icon: 'shopping-bag',
			cents: 12999,
			notes: null,
			paid: CHASE
		},
		{
			id: '6',
			daysAgo: 4,
			name: 'Gas',
			category: 'Gas',
			icon: 'fuel',
			cents: 4820,
			notes: null,
			paid: DEBIT
		},
		{
			id: '7',
			daysAgo: 6,
			name: 'Vet visit',
			category: 'Pets',
			icon: 'paw-print',
			cents: 21000,
			notes: null,
			paid: null
		},
		{
			id: '8',
			daysAgo: 9,
			name: 'Rent',
			category: 'Rent',
			icon: 'house',
			cents: 180000,
			notes: 'Recurring',
			paid: null
		}
	];
	const rows = ROWS.map((r) => ({ ...r, date: today.subtract({ days: r.daysAgo }) }));

	type Variant = 'details' | 'line' | 'icon';
	const VARIANTS: [Variant, string][] = [
		['details', 'Details only'],
		['line', 'Under the name'],
		['icon', 'Icon by amount']
	];
	let variant = $state<Variant>('line');
	let expanded = $state<string[]>(['3']);
	const toggle = (id: string) =>
		(expanded = expanded.includes(id) ? expanded.filter((x) => x !== id) : [...expanded, id]);

	const methodText = (m: Method) => [m.name, last4Label(m.last4)].filter(Boolean).join(' ');

	const toggleBtn =
		'rounded-md border border-gray-300 px-2.5 py-1 text-xs aria-pressed:bg-gray-900 aria-pressed:text-white dark:border-gray-700 dark:aria-pressed:bg-white dark:aria-pressed:text-gray-900';
	const template = '8.5rem minmax(12rem,1.5fr) 11rem 14rem 7.5rem minmax(12rem,2fr)';
	const cell = 'flex items-center truncate border-r border-gray-200 px-2 dark:border-gray-800';
</script>

<svelte:head>
	<title>Paid with on transactions mock</title>
</svelte:head>

<!-- Mock controls (not part of the page) -->
<div
	class="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-dashed border-gray-300 bg-gray-50/90 px-4 py-2 text-xs backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"
>
	<span class="font-medium text-gray-500">Phone row:</span>
	{#each VARIANTS as [value, text] (value)}
		<button
			type="button"
			class={toggleBtn}
			aria-pressed={variant === value}
			onclick={() => (variant = value)}
		>
			{text}
		</button>
	{/each}
</div>

<main class="mx-auto flex max-w-6xl flex-col gap-8 p-4 sm:p-6">
	<!-- Phone list -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-gray-500">Phone (expenses tab)</h2>
		<ul
			class="w-full max-w-93.75 overflow-hidden rounded-md border border-gray-200 dark:border-gray-800"
		>
			{#each rows as row, i (row.id)}
				{@const Icon = categoryIcon(row.icon)}
				{@const open = expanded.includes(row.id)}
				<li class={['border-gray-100 dark:border-gray-800', i < rows.length - 1 && 'border-b']}>
					<div class="flex items-center gap-2 py-2 pr-1 pl-3 text-sm">
						<Icon class="size-4 shrink-0 text-gray-500" aria-label={row.category} />
						<span class="shrink-0 text-xs text-gray-500 tabular-nums">
							{formatNumericDate(row.date)}
						</span>
						{#if variant === 'line'}
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate">{row.name}</span>
								{#if row.paid}
									<span class="flex items-center gap-1 truncate text-xs text-gray-500">
										<PaymentMethodIcon kind={row.paid.kind} class="size-3 shrink-0" />
										<span class="truncate">{methodText(row.paid)}</span>
									</span>
								{/if}
							</span>
						{:else}
							<span class="min-w-0 flex-1 truncate">{row.name}</span>
						{/if}
						{#if variant === 'icon' && row.paid}
							<PaymentMethodIcon kind={row.paid.kind} class="size-3.5 shrink-0 text-gray-400" />
							<span class="sr-only">Paid with {row.paid.name}</span>
						{/if}
						<span class="shrink-0 font-medium tabular-nums">{formatCents(row.cents)}</span>
						<button
							type="button"
							class="shrink-0 rounded-md p-2 text-gray-500 hover:bg-gray-100 aria-expanded:bg-gray-100 dark:hover:bg-gray-800 dark:aria-expanded:bg-gray-800"
							aria-expanded={open}
							aria-label="{open ? 'Hide' : 'Show'} details for {row.name}"
							onclick={() => toggle(row.id)}
						>
							<Ellipsis class="size-4" aria-hidden="true" />
						</button>
					</div>
					{#if open}
						<div class="bg-gray-50 dark:bg-gray-900">
							<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 pt-2 text-xs">
								<dt class="text-gray-500">Name</dt>
								<dd class="wrap-break-word">{row.name}</dd>
								<dt class="text-gray-500">Category</dt>
								<dd>{row.category}</dd>
								<dt class="text-gray-500">Paid with</dt>
								{#if row.paid}
									<dd class="flex items-center gap-1.5">
										<PaymentMethodIcon kind={row.paid.kind} class="size-3.5 text-gray-500" />
										{methodText(row.paid)}
									</dd>
								{:else}
									<dd class="text-gray-400 italic">Not recorded</dd>
								{/if}
								<dt class="text-gray-500">Notes</dt>
								<dd class={row.notes ? '' : 'text-gray-400 italic'}>{row.notes ?? 'No notes'}</dd>
							</dl>
							<div class="flex justify-end px-1 pb-1">
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
	</section>

	<!-- Desktop table -->
	<section class="flex flex-col gap-2">
		<h2 class="text-sm font-medium text-gray-500">Desktop table (new “Paid with” column)</h2>
		<div
			class="overflow-auto rounded-md border border-gray-200 text-sm dark:border-gray-800"
			role="table"
			aria-label="Expenses"
		>
			<div class="min-w-5xl">
				<div
					role="row"
					class="grid border-b border-gray-200 bg-gray-50 text-xs dark:border-gray-800 dark:bg-gray-900"
					style:grid-template-columns={template}
				>
					{#each [['Date', 'date'], ['Name', 'text'], ['Category', 'text'], ['Paid with', 'text'], ['Amount', 'money'], ['Notes', 'text']] as [name, type] (name)}
						<div
							role="columnheader"
							class={[
								'flex h-9 items-center gap-1.5 border-r border-gray-200 px-2 last:border-r-0 dark:border-gray-800',
								name === 'Amount' && 'flex-row-reverse',
								name === 'Paid with' && 'bg-amber-50 dark:bg-amber-950/40'
							]}
						>
							<span class="font-medium text-gray-900 dark:text-gray-100">{name}</span>
							<span class="font-mono text-[0.7rem] text-gray-400">{type}</span>
						</div>
					{/each}
				</div>
				{#each rows as row, i (row.id)}
					{@const Icon = categoryIcon(row.icon)}
					<div
						role="row"
						class={[
							'grid h-8 border-gray-100 bg-white dark:border-gray-800/60 dark:bg-gray-950',
							i < rows.length - 1 && 'border-b'
						]}
						style:grid-template-columns={template}
					>
						<div role="cell" class="{cell} tabular-nums">{formatDate(row.date)}</div>
						<div role="cell" class={cell}><span class="truncate">{row.name}</span></div>
						<div role="cell" class="{cell} gap-2">
							<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
							<span class="truncate">{row.category}</span>
						</div>
						<div role="cell" class="{cell} gap-2">
							{#if row.paid}
								<PaymentMethodIcon kind={row.paid.kind} class="size-4 shrink-0 text-gray-500" />
								<span class="truncate">{row.paid.name}</span>
								{#if row.paid.last4}
									<span class="shrink-0 text-xs text-gray-500 tabular-nums">
										{last4Label(row.paid.last4)}
									</span>
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
		<p class="text-xs text-gray-500">
			The new column is highlighted here only to point it out. Income keeps today’s columns.
		</p>
	</section>
</main>
