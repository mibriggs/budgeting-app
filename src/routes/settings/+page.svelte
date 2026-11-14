<!--
	Settings overview: a card per section with a short summary, full width for the two with the
	most to say (Budgets, Recurring) and half width for the rest. Sections that aren't built yet
	show as "Coming soon" and don't link anywhere. Only below `large` (11-inch iPad in
	landscape); larger screens use the sidebar instead (see +layout.svelte).
-->
<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Tags from '@lucide/svelte/icons/tags';
	import Wallet from '@lucide/svelte/icons/wallet';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import type { PageProps } from './$types';

	type SectionPath =
		| '/settings/budgets'
		| '/settings/recurring'
		| '/settings/categories'
		| '/settings/notifications'
		| '/settings/widget';

	let { data }: PageProps = $props();

	const monthName = $derived(data.today.toLocaleString('en-US', { month: 'short' }));
	const budgetUsed = $derived(
		data.budgets.budgetedCents > 0 ? data.budgets.spentCents / data.budgets.budgetedCents : 0
	);

	function whenLabel(date: PlainDate): string {
		const days = data.today.until(date).days;
		if (days === 0) return 'today';
		if (days === 1) return 'tomorrow';
		if (days < 7) return `on ${date.toLocaleString('en-US', { weekday: 'long' })}`;
		return `on ${date.toLocaleString('en-US', { month: 'short', day: 'numeric' })}`;
	}

	// Whether notifications are on for this browser can only be checked here, not on the server.
	type PushState = 'checking' | 'on' | 'off' | 'unavailable';
	let push = $state<PushState>('checking');
	onMount(async () => {
		if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
			push = 'unavailable';
			return;
		}
		try {
			const reg = await navigator.serviceWorker.getRegistration();
			const endpoint = (await reg?.pushManager.getSubscription())?.endpoint;
			push = endpoint && data.notifications.endpoints.includes(endpoint) ? 'on' : 'off';
		} catch {
			push = 'unavailable';
		}
	});
	const widgetLastUsed = $derived.by(() => {
		const at = data.widget.lastUsedAt;
		if (!at) return 'Not used yet';
		const minutes = (Date.now() - at.getTime()) / 60_000;
		if (minutes < 90) return 'Used in the last hour';
		if (minutes < 60 * 24) return `Used ${Math.round(minutes / 60)} hours ago`;
		return `Used ${at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
	});
	const deviceCount = $derived(data.notifications.endpoints.length);
	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
</script>

<svelte:head>
	<title>Settings · Budget</title>
</svelte:head>

{#snippet card(
	to: SectionPath | null,
	label: string,
	Icon: typeof Wallet,
	wide: boolean,
	body: Snippet
)}
	{#if to}
		<a
			href={resolve(to)}
			class={[
				'flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-4 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700',
				wide && 'col-span-2'
			]}
		>
			{@render cardContent(label, Icon, wide, true, body)}
		</a>
	{:else}
		<!-- Not built yet: no link, muted. -->
		<div
			class={[
				'flex flex-col gap-2 rounded-2xl border border-dashed border-gray-300 p-4 text-gray-500 dark:border-gray-700 dark:text-gray-400',
				wide && 'col-span-2'
			]}
		>
			{@render cardContent(label, Icon, wide, false, body)}
		</div>
	{/if}
{/snippet}

<!-- Icon and title. Half width stacks the icon above the title so long titles fit on phones. -->
{#snippet cardContent(
	label: string,
	Icon: typeof Wallet,
	wide: boolean,
	linked: boolean,
	body: Snippet
)}
	<span class={['flex gap-2', wide ? 'items-center' : 'flex-col']}>
		<span class="flex items-center justify-between">
			<span
				class="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800"
			>
				<Icon class="size-4" aria-hidden="true" />
			</span>
			{#if !wide && linked}<ChevronRight class="size-4 text-gray-400" aria-hidden="true" />{/if}
		</span>
		<span class="flex-1 leading-tight font-semibold">{label}</span>
		{#if wide && linked}<ChevronRight class="size-4 text-gray-400" aria-hidden="true" />{/if}
	</span>
	{@render body()}
{/snippet}

{#snippet budgetsBody()}
	{#if data.budgets.count === 0}
		<span class="text-sm text-gray-500 dark:text-gray-400">
			No budgets yet. Set a monthly limit per category.
		</span>
	{:else}
		<span class="flex flex-col gap-1.5">
			<span class="flex items-baseline justify-between gap-2">
				<span>
					<span class="font-semibold tabular-nums">
						{formatCentsWhole(data.budgets.budgetedCents)}
					</span>
					budgeted in {monthName}
				</span>
				<span class="text-xs text-gray-500 dark:text-gray-400">
					{plural(data.budgets.count, 'category', 'categories')}
				</span>
			</span>
			<span class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
				<span
					class={[
						'block h-full rounded-full',
						budgetUsed > 1 ? 'bg-red-500' : 'bg-gray-900 dark:bg-gray-100'
					]}
					style:width="{Math.min(budgetUsed, 1) * 100}%"
				></span>
			</span>
			<span class="text-xs text-gray-500 dark:text-gray-400">
				{Math.round(budgetUsed * 100)}% spent ·
				{data.budgets.daysLeft === 0 ? 'last day' : `${plural(data.budgets.daysLeft, 'day')} left`}
			</span>
		</span>
	{/if}
{/snippet}

{#snippet recurringBody()}
	{#if data.recurring.active === 0}
		<span class="text-sm text-gray-500 dark:text-gray-400">
			{data.recurring.inactive > 0
				? `${plural(data.recurring.inactive, 'recurring expense')} paused or ended.`
				: 'Nothing recurring yet. Add rent, subscriptions and other repeat charges.'}
		</span>
	{:else}
		<span class="flex flex-col gap-1">
			<!-- "About" and whole dollars, like the Recurring page: weekly items make it an average. -->
			<span>
				About
				<span class="font-semibold tabular-nums"
					>{formatCentsWhole(data.recurring.monthlyCents)}</span
				>
				a month · {data.recurring.active} active
			</span>
			{#if data.recurring.next}
				<span class="text-xs text-gray-500 dark:text-gray-400">
					Next: {data.recurring.next.name}, {formatCents(data.recurring.next.amountCents)}
					{whenLabel(data.recurring.next.date)}
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet categoriesBody()}
	<span class="text-xs text-gray-500 dark:text-gray-400">
		{data.categories.expense} expense<br />{data.categories.income} income
	</span>
{/snippet}

{#snippet notificationsBody()}
	<span class="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
		{#if !data.notifications.configured}
			<span>Not set up on the server</span>
		{:else}
			<span class="flex items-center gap-1.5">
				<span
					class={[
						'size-1.5 shrink-0 rounded-full',
						push === 'on' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
					]}
				></span>
				{push === 'checking'
					? 'Checking…'
					: push === 'on'
						? 'On for this device'
						: push === 'off'
							? 'Off on this device'
							: 'Not available here'}
			</span>
			<span>{deviceCount === 0 ? 'No devices yet' : plural(deviceCount, 'device')}</span>
		{/if}
	</span>
{/snippet}

{#snippet soon(text: string)}
	<span class="flex flex-col items-start gap-1.5 text-xs">
		<span>{text}</span>
		<span
			class="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
		>
			Coming soon
		</span>
	</span>
{/snippet}
{#snippet paymentBody()}
	{@render soon('Cards, cash and payment apps')}
{/snippet}
{#snippet widgetBody()}
	<span class="flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
		{#if data.widget.tokens === 0}
			<span>Home Screen widget</span>
			<span>Not set up</span>
		{:else}
			<span>{plural(data.widget.tokens, 'token')}</span>
			<span>{widgetLastUsed}</span>
		{/if}
	</span>
{/snippet}

<div class="grid max-w-3xl grid-cols-2 gap-3 lg:grid-cols-4">
	{@render card('/settings/budgets', 'Budgets', Wallet, true, budgetsBody)}
	{@render card('/settings/recurring', 'Recurring', Repeat, true, recurringBody)}
	{@render card('/settings/categories', 'Categories', Tags, false, categoriesBody)}
	{@render card('/settings/notifications', 'Notifications', Bell, false, notificationsBody)}
	{@render card('/settings/widget', 'Widget', LayoutGrid, false, widgetBody)}
	{@render card(null, 'Payment methods', CreditCard, false, paymentBody)}
</div>
