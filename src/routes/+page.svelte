<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Zap from '@lucide/svelte/icons/zap';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AddTransactionDialog from '#lib/components/AddTransactionDialog.svelte';
	import QuickAddDialog from '#lib/components/QuickAddDialog.svelte';
	import InboxCard from '#lib/components/dashboard/InboxCard.svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import BudgetCard from '#lib/components/dashboard/BudgetCard.svelte';
	import CashFlowCard from '#lib/components/dashboard/CashFlowCard.svelte';
	import CategorySpending from '#lib/components/dashboard/CategorySpending.svelte';
	import CreditCardsCard from '#lib/components/dashboard/CreditCardsCard.svelte';
	import MonthlyChart from '#lib/components/dashboard/MonthlyChart.svelte';
	import PaceChart from '#lib/components/dashboard/PaceChart.svelte';
	import RecentExpensesCard from '#lib/components/dashboard/RecentExpensesCard.svelte';
	import StatTiles from '#lib/components/dashboard/StatTiles.svelte';
	import UpcomingRecurringCard from '#lib/components/dashboard/UpcomingRecurringCard.svelte';
	import type { PlainDate, Temporal } from '#lib/dates.ts';
	import { formatDate, formatMonth, monthRangeParams } from '#lib/date-range.ts';
	import { updateQuery } from '#lib/url.ts';
	import { saveCreditCardsCard } from '#lib/home-cards.ts';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { blur, slide } from 'svelte/transition';
	import type { TransactionKind } from '#lib/server/budget/transactions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const monthName = (month: Temporal.PlainYearMonth) => formatMonth(month, { year: false });
	let thisMonthLabel = $derived(formatMonth(data.dashboard.month));

	// "Credit Cards" card. Hidden right away when the × is pressed (then saved); Undo shows it
	// again. It blurs out, then the space slides shut so the cards below move up smoothly.
	// svelte-ignore state_referenced_locally
	let showCreditCards = $state(data.showCreditCards);
	const still = $derived(prefersReducedMotion.current);
	const cardBlur = (node: Element) =>
		still ? { duration: 0 } : blur(node, { duration: 300, amount: 8, easing: cubicOut });
	const closeGap = (node: Element) =>
		still ? { duration: 0 } : slide(node, { duration: 250, delay: 250, easing: cubicOut });

	async function setCreditCards(show: boolean) {
		showCreditCards = show;
		if (!(await saveCreditCardsCard(show))) showCreditCards = !show;
	}

	async function hideCreditCards() {
		await setCreditCards(false);
		if (showCreditCards) return; // Couldn't save; it's back.
		toast('Credit Cards hidden from home.', {
			description: 'Turn it back on in Settings → Payment Methods.',
			action: { label: 'Undo', onClick: () => setCreditCards(true) }
		});
	}

	let addKind = $state<TransactionKind>('expense');
	let addOpen = $state(false);
	let quickAddOpen = $state(false);

	// One Add button; the dialog starts on Expense (the common case) and has a switch for Income.
	function openAdd() {
		addKind = 'expense';
		addOpen = true;
	}

	function onCreated({
		kind,
		name,
		date
	}: {
		kind: TransactionKind;
		name: string;
		date: PlainDate;
	}) {
		toast.success(`Added “${name}”.`, {
			description: formatDate(date),
			// Opens the right tab, on the month the new entry is in.
			action: {
				label: 'View',
				onClick: () =>
					goto(
						resolve(
							`/transactions${updateQuery('', {
								...monthRangeParams(date, data.today),
								tab: kind === 'income' ? 'income' : null
							})}`
						)
					)
			}
		});
	}

	const primary =
		'flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
	// Centred content so the buttons stay tidy when they stretch to fill the row on a phone.
	const secondary =
		'press flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:hover:bg-gray-800 dark:disabled:hover:bg-transparent';
	/** Phone: grow to share the row; from `sm`: natural width. */
	const grow = 'grow whitespace-nowrap sm:grow-0';
</script>

<svelte:head>
	<title>CentJar</title>
</svelte:head>

<AppHeader name={data.displayName} home />

<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<!-- Quick actions at the top (under "CentJar"). On a phone the row spans the same width as the
	     cards below (each button grows from its own width to share the space) and says
	     "Transactions" instead of "View transactions"; from `sm` up they sit at the left at their
	     natural size. Wraps on very narrow screens rather than overflowing. -->
	<div class="flex flex-wrap items-center gap-2 sm:justify-start sm:gap-3">
		<button type="button" class="{primary} {grow}" onclick={openAdd}>
			<Plus class="size-4" aria-hidden="true" />
			Add
		</button>
		<!-- Quick add: paste a bank alert or type a shorthand, check what it read, tap a category. -->
		<button type="button" class="{secondary} {grow}" onclick={() => (quickAddOpen = true)}>
			<Zap class="size-4" aria-hidden="true" />
			Quick add
		</button>
		<a href={resolve('/transactions')} class="{secondary} {grow}">
			<span class="sm:hidden">Transactions</span>
			<span class="hidden sm:inline">View transactions</span>
		</a>
	</div>

	<!-- Quick add inbox: what's waiting to be reviewed (a quiet line when nothing is). -->
	<InboxCard items={data.inboxPreview} count={data.inboxCount} today={data.today} />

	<StatTiles tiles={data.dashboard.tiles} />

	<!-- Two rows of two: this month's spending by category and upcoming recurring charges; then
	     recent expenses and budgets. Then credit cards, cash flow, pace and the 6-month trend, each
	     full width. -->
	<div class="grid gap-4 lg:grid-cols-2">
		<CategorySpending
			rows={data.dashboard.byCategory}
			slices={data.dashboard.slices}
			subtitle={thisMonthLabel}
		/>
		<UpcomingRecurringCard
			charges={data.dashboard.upcoming.charges}
			nextLater={data.dashboard.upcoming.nextLater}
			today={data.today}
		/>
		<RecentExpensesCard items={data.dashboard.recent} today={data.today} />
		<BudgetCard summary={data.dashboard.budgets} subtitle={thisMonthLabel} />
		{#if showCreditCards}
			<div class="lg:col-span-2" transition:closeGap>
				<div transition:cardBlur>
					<CreditCardsCard
						cards={data.dashboard.cards}
						today={data.today}
						onHide={hideCreditCards}
					/>
				</div>
			</div>
		{/if}
		<div class="lg:col-span-2">
			<CashFlowCard flow={data.dashboard.flow} range={data.dashboard.flowRange} />
		</div>
		<div class="lg:col-span-2">
			<PaceChart
				points={data.dashboard.pace}
				thisMonthLabel={monthName(data.dashboard.month)}
				lastMonthLabel={monthName(data.dashboard.month.subtract({ months: 1 }))}
			/>
		</div>
		<div class="lg:col-span-2"><MonthlyChart months={data.dashboard.trend} /></div>
	</div>
</main>

<QuickAddDialog bind:open={quickAddOpen} />

<AddTransactionDialog
	bind:open={addOpen}
	bind:kind={addKind}
	chooseKind
	categories={data.categories}
	paymentMethods={data.paymentMethods}
	today={data.today}
	action="/transactions?/create"
	{onCreated}
/>
