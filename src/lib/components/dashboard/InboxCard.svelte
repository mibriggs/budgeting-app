<!--
	@component
	Home page Quick add inbox card. With items waiting: how many, then the first few, each with a
	line on what it needs ("Ready as Groceries", "Pick a category", "Couldn't read this"); tapping
	one, or Review all, opens /inbox. With none: one quiet line, so Home doesn't jump around.
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FileQuestion from '@lucide/svelte/icons/file-question';
	import Inbox from '@lucide/svelte/icons/inbox';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { resolve } from '$app/paths';
	import { categoryIcon } from '#lib/category-icons.ts';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatCents } from '#lib/money.ts';

	type Preview = {
		id: string;
		status: 'reading' | 'ready' | 'failed';
		isExpense: boolean;
		name: string | null;
		message: string;
		amountCents: number | null;
		purchaseDate: PlainDate | null;
		categoryName: string | null;
		categoryIcon: string | null;
		note: string | null;
	};

	let { items, count, today }: { items: Preview[]; count: number; today: PlainDate } = $props();

	/** One line on what an item needs; `warn` shows the warning icon. */
	function blurb(item: Preview): { text: string; warn: boolean } {
		if (item.status === 'reading') return { text: 'Reading…', warn: false };
		if (item.status === 'failed') return { text: 'Couldn’t read this', warn: true };
		if (!item.isExpense) return { text: 'Not a purchase?', warn: true };
		if (item.note) return { text: item.note, warn: true };
		if (!item.categoryName) return { text: 'Pick a category', warn: false };
		return { text: `Ready as ${item.categoryName}`, warn: false };
	}

	function when(d: PlainDate | null): string {
		if (!d) return '';
		const days = d.until(today).days;
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
	}

	const linkClass =
		'flex shrink-0 items-center gap-0.5 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100';
</script>

{#if count > 0}
	<section
		class="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
		aria-labelledby="home-inbox-title"
	>
		<header class="flex items-center justify-between gap-3">
			<h2 id="home-inbox-title" class="flex items-center gap-2 text-sm font-medium">
				Inbox
				<span
					class="min-w-5 rounded-full bg-gray-900 px-1.5 text-center text-xs leading-5 font-semibold text-white tabular-nums dark:bg-white dark:text-gray-900"
				>
					{count}
				</span>
			</h2>
			<a href={resolve('/inbox')} class={linkClass}>
				{count > items.length ? `Review all ${count}` : 'Review'}
				<ChevronRight class="size-3.5" aria-hidden="true" />
			</a>
		</header>
		<ul class="-mx-1 grid grid-cols-1 lg:grid-cols-3 lg:gap-2">
			{#each items as item (item.id)}
				{@const b = blurb(item)}
				{@const Icon =
					item.status === 'failed'
						? FileQuestion
						: item.status === 'reading'
							? LoaderCircle
							: categoryIcon(item.categoryIcon)}
				<li class="min-w-0">
					<a
						href={resolve('/inbox')}
						class="flex w-full items-center gap-3 rounded-md px-1 py-2 hover:bg-gray-50 dark:hover:bg-gray-900"
					>
						<span
							class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
						>
							<Icon
								class={[
									'size-4 text-gray-600 dark:text-gray-300',
									item.status === 'reading' && 'animate-spin'
								]}
								aria-hidden="true"
							/>
						</span>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm">{item.name ?? item.message}</span>
							<span
								class="flex min-w-0 items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
							>
								{#if b.warn}
									<TriangleAlert
										class="size-3 shrink-0 text-(--status-warning)"
										aria-hidden="true"
									/>
								{/if}
								<span class="truncate">{b.text}</span>
							</span>
						</span>
						<span class="flex shrink-0 flex-col items-end">
							{#if item.amountCents}
								<span class="text-sm font-medium tabular-nums">{formatCents(item.amountCents)}</span
								>
							{/if}
							<span class="text-xs text-gray-500 dark:text-gray-400">{when(item.purchaseDate)}</span
							>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{:else}
	<section
		class="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
		aria-labelledby="home-inbox-title"
	>
		<span class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800">
			<Inbox class="size-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
		</span>
		<div class="min-w-0 flex-1">
			<h2 id="home-inbox-title" class="text-sm font-medium">Inbox</h2>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				All caught up. Anything you Quick add waits here to review.
			</p>
		</div>
		<a href={resolve('/inbox')} class={linkClass}>
			Open <ChevronRight class="size-3.5" aria-hidden="true" />
		</a>
	</section>
{/if}
