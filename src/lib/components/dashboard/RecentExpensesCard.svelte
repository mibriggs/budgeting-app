<!--
	@component
	Home page "Recent Expenses" card: the latest entries up to today, newest first. Each row shows
	the category icon, the name, the category and how it was paid, then the amount and a short
	date ("Today", "Yesterday", "Mon", "Nov 12"). Entries a recurring expense added get a small
	repeat mark. Income (when included) shows in green with a "+".
	With nothing yet, it's a one-line hint.
-->
<script module lang="ts">
	import type { PaymentMethodKind } from '#lib/payment-methods.ts';
	import type { PlainDate } from '#lib/dates.ts';

	export type RecentItem = {
		id: string;
		kind: 'expense' | 'income';
		name: string;
		date: PlainDate;
		amountCents: number;
		categoryName: string;
		categoryIcon: string | null;
		paymentMethodKind: PaymentMethodKind | null;
		paymentMethodName: string | null;
		/** Added by a recurring expense. */
		recurring: boolean;
	};
</script>

<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import { resolve } from '$app/paths';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatCents } from '#lib/money.ts';
	import PaymentMethodIcon from '../PaymentMethodIcon.svelte';
	import ChartCard from './ChartCard.svelte';

	let {
		items,
		today,
		title = 'Recent Expenses'
	}: { items: RecentItem[]; today: PlainDate; title?: string } = $props();

	function when(d: PlainDate): string {
		const days = d.until(today).days;
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days < 7) return d.toLocaleString('en-US', { weekday: 'short' });
		return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<ChartCard {title}>
	{#if items.length}
		<ul class="-mx-1 flex flex-col">
			{#each items as item (item.id)}
				{@const Icon = categoryIcon(item.categoryIcon)}
				<li class="flex items-center gap-3 rounded-md px-1 py-2">
					<span
						class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
						title={item.categoryName}
					>
						<Icon class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
					</span>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="flex items-center gap-1.5 text-sm">
							<span class="truncate">{item.name}</span>
							{#if item.recurring}
								<Repeat class="size-3 shrink-0 text-gray-400" aria-label="Recurring" role="img" />
							{/if}
						</span>
						<span class="flex min-w-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
							<span class="truncate">{item.categoryName}</span>
							{#if item.paymentMethodKind && item.paymentMethodName}
								<span aria-hidden="true">·</span>
								<PaymentMethodIcon kind={item.paymentMethodKind} class="size-3 shrink-0" />
								<span class="truncate">{item.paymentMethodName}</span>
							{/if}
						</span>
					</div>
					<div class="flex shrink-0 flex-col items-end">
						<span
							class={[
								'text-sm font-medium tabular-nums',
								item.kind === 'income' && 'text-green-700 dark:text-green-400'
							]}
						>
							{item.kind === 'income' ? '+' : ''}{formatCents(item.amountCents)}
						</span>
						<span class="text-xs text-gray-500 dark:text-gray-400">{when(item.date)}</span>
					</div>
				</li>
			{/each}
		</ul>
		<!-- Pinned to the bottom, level with "Show all" in the Upcoming card beside it. -->
		<a
			href={resolve('/transactions')}
			class="mt-auto flex items-center gap-0.5 self-end text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
		>
			View all transactions <ChevronRight class="size-3.5" aria-hidden="true" />
		</a>
	{:else}
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Nothing yet. Expenses you add show up here.
		</p>
	{/if}
</ChartCard>
