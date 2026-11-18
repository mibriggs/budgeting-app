<!--
	@component
	Home page "Credit cards" card: one credit card at a time, picked from a dropdown when there's
	more than one (the choice is remembered on this device). For a card with a statement closing
	date it shows three numbers:
	- This cycle: spending since the last statement closed, with a bar for the share of the limit
	  (amber from 30%, red past the limit).
	- Last statement: the total of the cycle before.
	- Next payment: the last statement's amount and due date while that's still ahead, else when
	  the current cycle's bill will be due.
	A card without a closing date shows this month's spending and a link to add the date.
	Only expenses recorded as "Paid with" the card count; it isn't the bank's balance.
	With no credit cards yet, it's a short prompt linking to Settings → Payment methods.
	The × asks the page to hide the card (the page saves that and animates it away).
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import X from '@lucide/svelte/icons/x';
	import { Select } from 'bits-ui';
	import { resolve } from '$app/paths';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import { last4Label, UTILIZATION_WARN } from '#lib/payment-methods.ts';
	import type { CreditCardSummary } from '#lib/server/budget/payment-methods.ts';
	import ChartCard from './ChartCard.svelte';

	let {
		cards,
		today,
		onHide
	}: {
		cards: CreditCardSummary[];
		today: PlainDate;
		/** The × was pressed: hide the card from the home page. */
		onHide: () => void;
	} = $props();

	const STORAGE_KEY = 'credit-card-view';
	// svelte-ignore state_referenced_locally
	let selectedId = $state(cards[0]?.id ?? '');

	// Read the saved choice after mount (the server always renders the first card).
	$effect(() => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved && cards.some((c) => c.id === saved)) selectedId = saved;
		} catch {
			// Storage blocked: keep the first card.
		}
	});

	function select(id: string) {
		selectedId = id;
		try {
			localStorage.setItem(STORAGE_KEY, id);
		} catch {
			// Storage blocked: the choice still works for this visit.
		}
	}

	// Undefined when there are no credit cards yet (the prompt shows instead).
	const card = $derived<CreditCardSummary | undefined>(
		cards.find((c) => c.id === selectedId) ?? cards[0]
	);

	const short = (d: PlainDate) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
	function inDays(d: PlainDate): string {
		const days = today.until(d).days;
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		return `in ${days} days`;
	}

	const spent = $derived(card ? (card.cycle?.spentCents ?? card.monthCents) : 0);
	const share = $derived(card?.limitCents ? spent / card.limitCents : null);
	const barColor = $derived(
		share === null
			? ''
			: share > 1
				? 'var(--status-critical)'
				: share >= UTILIZATION_WARN
					? 'var(--status-warning)'
					: 'var(--chart-1)'
	);
	const dueSoon = $derived(card?.nextDue ? today.until(card.nextDue.date).days <= 3 : false);

	const label = 'text-xs text-gray-500 dark:text-gray-400';
	const big = 'text-xl font-semibold tabular-nums';
</script>

<ChartCard
	title="Credit cards"
	subtitle={cards.length === 1 && card
		? [card.name, last4Label(card.last4)].filter(Boolean).join(' ')
		: undefined}
>
	{#snippet actions()}
		<div class="flex items-center gap-1">
			{#if card && cards.length > 1}
				<Select.Root
					type="single"
					value={card.id}
					onValueChange={select}
					items={cards.map((c) => ({ value: c.id, label: c.name }))}
				>
					<Select.Trigger
						data-no-press
						aria-label="Credit card"
						class="flex max-w-44 items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium outline-none hover:bg-gray-100 focus-visible:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800"
					>
						<!-- No focus outline: Bits refocuses this button when the list closes, and Safari
						     draws a ring for that even after a tap. Keyboard focus shows as the hover fill. -->
						<CreditCard class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
						<span class="truncate">{card.name}</span>
						<ChevronDown class="size-3.5 shrink-0 text-gray-500" aria-hidden="true" />
					</Select.Trigger>
					<Select.Portal>
						<Select.Content
							sideOffset={4}
							align="end"
							class="z-50 max-h-72 min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900"
						>
							<Select.Viewport>
								{#each cards as c (c.id)}
									<Select.Item
										value={c.id}
										label={c.name}
										class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800"
									>
										{#snippet children({ selected })}
											<span class="truncate">{c.name}</span>
											{#if c.last4}
												<span class="shrink-0 text-xs text-gray-500 tabular-nums">
													{last4Label(c.last4)}
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
			{/if}
			<button
				type="button"
				onclick={onHide}
				class="-mr-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				aria-label="Hide Credit cards from home"
				title="Hide from home"
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
	{/snippet}

	{#if card}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
			<!-- This cycle (or month) and the limit: full width on phones, a third from `sm`. -->
			<div class="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
				<span class={label}>
					{card.cycle ? `Since ${short(card.cycle.from)}` : 'This month'}
				</span>
				<span class={big}>{formatCents(spent)}</span>
				{#if share !== null && card.limitCents}
					<div
						class="h-1.5 overflow-hidden rounded-full"
						style:background="color-mix(in oklab, {barColor} var(--track), transparent)"
						role="img"
						aria-label="{Math.round(share * 100)}% of the {formatCentsWhole(card.limitCents)} limit"
					>
						<div
							class="h-full rounded-full"
							style:width="{Math.min(share, 1) * 100}%"
							style:background={barColor}
						></div>
					</div>
					<span class={label}>
						{Math.round(share * 100)}% of {formatCentsWhole(card.limitCents)} limit
					</span>
				{/if}
				{#if card.cycle}
					<span class={label}
						>Closes {short(card.cycle.closesOn)} ({inDays(card.cycle.closesOn)})</span
					>
				{/if}
			</div>

			{#if card.statement}
				<div class="flex flex-col gap-1.5">
					<span class={label}>Last statement</span>
					<span class={big}>{formatCents(card.statement.totalCents)}</span>
					<span class={label}>{short(card.statement.from)} – {short(card.statement.to)}</span>
				</div>
			{/if}

			{#if card.nextDue}
				<div class="flex flex-col gap-1.5">
					<span class={label}>Next payment</span>
					<span class={[big, dueSoon && 'text-amber-700 dark:text-amber-400']}>
						{short(card.nextDue.date)}
					</span>
					<span class={label}>
						{card.nextDue.amountCents !== null
							? `${formatCents(card.nextDue.amountCents)} · ${inDays(card.nextDue.date)}`
							: card.cycle
								? `For the cycle closing ${short(card.cycle.closesOn)}`
								: inDays(card.nextDue.date)}
					</span>
				</div>
			{/if}
		</div>

		{#if !card.cycle}
			<p class={label}>
				<a
					href={resolve('/settings/payment-methods')}
					class="underline hover:text-gray-900 dark:hover:text-gray-100"
				>
					Add the statement closing date</a
				> to see billing cycles and statement totals.
			</p>
		{/if}
		<p class="text-xs text-gray-400 dark:text-gray-500">
			Only expenses marked “Paid with” this card. Your bank’s balance may differ.
		</p>
	{:else}
		<div class="flex items-start gap-3">
			<span
				class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
			>
				<CreditCard class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
			</span>
			<div class="flex flex-col items-start gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Add a credit card to track billing cycles, statements and due dates.
				</p>
				<a
					href={resolve('/settings/payment-methods')}
					class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				>
					Add a credit card
				</a>
			</div>
		</div>
	{/if}
</ChartCard>
