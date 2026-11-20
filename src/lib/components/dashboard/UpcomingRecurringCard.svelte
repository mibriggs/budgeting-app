<!--
	@component
	Home page "Upcoming Payments" card: each recurring charge due in the next `days` days,
	soonest first, with the total in the subtitle. A row is a date block, the name with its
	schedule and payment method, then the amount and how far off it is. The date block is tiered
	by how soon it's due: amber (block and text) within 3 days, soft blue within 15, plain grey
	after that.
	Shows the first few rows (the subtitle total still covers the whole window), then a
	"Manage recurring" link at the bottom right, level with "View all transactions" beside it.
	- Recurring expenses exist but none fall in the window: says so and names the next one.
	- No recurring expenses at all: a short prompt linking to Settings → Recurring.
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { resolve } from '$app/paths';
	import type { UpcomingCharge } from '#lib/dashboard.ts';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatCents } from '#lib/money.ts';
	import PaymentMethodIcon from '../PaymentMethodIcon.svelte';
	import ChartCard from './ChartCard.svelte';

	let {
		charges,
		today,
		days = 30,
		nextLater = null,
		visible = 5
	}: {
		charges: UpcomingCharge[];
		today: PlainDate;
		/** The window `charges` covers. */
		days?: number;
		/** The first charge after the window, for when nothing falls inside it. */
		nextLater?: UpcomingCharge | null;
		/** How many rows to list. */
		visible?: number;
	} = $props();

	const shown = $derived(charges.slice(0, visible));
	const total = $derived(charges.reduce((sum, c) => sum + c.amountCents, 0));

	const away = (d: PlainDate) => today.until(d).days;
	function inDays(d: PlainDate): string {
		const n = away(d);
		if (n === 0) return 'Today';
		if (n === 1) return 'Tomorrow';
		return `In ${n} days`;
	}
	const long = (d: PlainDate) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
</script>

<!-- Pinned to the bottom right, level with "View all transactions" in the card beside it. -->
{#snippet manage()}
	<a
		href={resolve('/settings/recurring')}
		class="mt-auto flex items-center gap-0.5 self-end text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
	>
		Manage recurring <ChevronRight class="size-3.5" aria-hidden="true" />
	</a>
{/snippet}

<ChartCard
	title="Upcoming Payments"
	subtitle={charges.length ? `Next ${days} days · ${formatCents(total)}` : undefined}
>
	{#if charges.length}
		<ul class="-mx-1 flex flex-col">
			{#each shown as c (c.id)}
				{@const soon = away(c.date) <= 3}
				{@const near = away(c.date) <= 15}
				<li class="flex items-center gap-3 rounded-md px-1 py-2">
					<span
						class={[
							'flex w-10 shrink-0 flex-col items-center rounded-md border py-0.5 leading-tight',
							soon
								? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
								: near
									? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
									: 'border-gray-200 dark:border-gray-800'
						]}
						aria-hidden="true"
					>
						<span class="text-[10px] font-medium uppercase opacity-70">
							{c.date.toLocaleString('en-US', { month: 'short' })}
						</span>
						<span class="text-sm font-semibold tabular-nums">{c.date.day}</span>
					</span>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm">{c.name}</span>
						<span class="flex min-w-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
							<span class="truncate">{c.schedule}</span>
							{#if c.paymentMethodKind && c.paymentMethodName}
								<span aria-hidden="true">·</span>
								<PaymentMethodIcon kind={c.paymentMethodKind} class="size-3 shrink-0" />
								<span class="truncate">{c.paymentMethodName}</span>
							{/if}
						</span>
					</div>
					<div class="flex shrink-0 flex-col items-end">
						<span class="text-sm font-medium tabular-nums">{formatCents(c.amountCents)}</span>
						<span
							class={[
								'text-xs',
								soon
									? 'font-medium text-amber-700 dark:text-amber-400'
									: 'text-gray-500 dark:text-gray-400'
							]}
						>
							<span class="sr-only">{long(c.date)}, </span>{inDays(c.date)}
						</span>
					</div>
				</li>
			{/each}
		</ul>
		{@render manage()}
	{:else if nextLater}
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Nothing due in the next {days} days. Next up: {nextLater.name},
			{formatCents(nextLater.amountCents)} on {long(nextLater.date)}.
		</p>
		{@render manage()}
	{:else}
		<div class="flex items-start gap-3">
			<span
				class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
			>
				<Repeat class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
			</span>
			<div class="flex flex-col items-start gap-2">
				<p class="text-sm text-gray-600 dark:text-gray-300">
					Add bills and subscriptions that repeat to see what’s coming up.
				</p>
				<a
					href={resolve('/settings/recurring')}
					class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				>
					Add a recurring expense
				</a>
			</div>
		</div>
	{/if}
</ChartCard>
