<!--
	Quick add inbox: pasted bank alerts and typed notes, read and waiting to be added. Tap a category
	on an item to add it as an expense; nothing here counts toward any total until then. While an
	item is still being read, the page checks back every few seconds.
-->
<script lang="ts">
	import Inbox from '@lucide/svelte/icons/inbox';
	import Zap from '@lucide/svelte/icons/zap';
	import { refreshAll } from '$app/navigation';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import QuickAddDialog from '#lib/components/QuickAddDialog.svelte';
	import PendingCard from './PendingCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let quickAddOpen = $state(false);

	// Something still reading: check back until it's done.
	const reading = $derived(data.items.some((i) => i.status === 'reading'));
	$effect(() => {
		if (!reading) return;
		const timer = setInterval(() => refreshAll(), 3000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>Inbox · CentJar</title>
</svelte:head>

<AppHeader name={data.displayName} />

<main class="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
	<header class="flex items-end justify-between gap-3">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-semibold">
				Inbox
				{#if data.items.length}
					<span class="text-base font-normal text-gray-500 tabular-nums dark:text-gray-400">
						{data.items.length}
					</span>
				{/if}
			</h1>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				Nothing here counts toward your totals until you add it.
			</p>
		</div>
		<button
			type="button"
			class="press flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
			onclick={() => (quickAddOpen = true)}
		>
			<Zap class="size-4" aria-hidden="true" /> Quick add
		</button>
	</header>

	{#if data.items.length}
		<ul class="flex flex-col gap-3">
			{#each data.items as item (item.id + item.status)}
				<PendingCard
					{item}
					categories={data.categories}
					paymentMethods={data.paymentMethods}
					today={data.today}
				/>
			{/each}
		</ul>
	{:else}
		<section
			class="flex flex-col items-center gap-2 rounded-lg border border-gray-200 px-6 py-12 text-center dark:border-gray-800"
		>
			<span class="grid size-10 place-items-center rounded-full bg-gray-100 dark:bg-gray-800">
				<Inbox class="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
			</span>
			<p class="text-sm font-medium">All caught up</p>
			<p class="max-w-xs text-sm text-gray-500 dark:text-gray-400">
				Paste a bank alert or type something like "5.06 apple card snacks" into Quick add, and it
				waits here until you add it.
			</p>
		</section>
	{/if}
</main>

<QuickAddDialog bind:open={quickAddOpen} />
