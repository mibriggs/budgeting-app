<!--
	Settings → Categories: the active expense and income categories, read-only for now.
	Adding, renaming, changing icons and archiving are planned (see .claude/future-plans.md).
-->
<script lang="ts">
	import { categoryIcon } from '#lib/category-icons.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let groups = $derived([
		{ title: 'Expense', list: data.expense },
		{ title: 'Income', list: data.income }
	]);
</script>

<svelte:head>
	<title>Categories · Settings · Budget</title>
</svelte:head>

<section aria-labelledby="section-title">
	<h2 id="section-title" class="text-lg font-semibold">Categories</h2>
	<p class="text-sm text-gray-500 dark:text-gray-400">
		What you sort expenses and income into. Adding, renaming and archiving categories is coming
		soon.
	</p>

	{#each groups as group (group.title)}
		<h3 class="mt-5 text-sm font-medium text-gray-500 dark:text-gray-400">
			{group.title} · {group.list.length}
		</h3>
		<ul
			class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
		>
			{#each group.list as category (category.id)}
				{@const Icon = categoryIcon(category.icon)}
				<li class="flex items-center gap-3 px-3 py-2">
					<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
					<span class="min-w-0 flex-1 truncate text-sm">{category.name}</span>
				</li>
			{:else}
				<li class="px-3 py-4 text-sm text-gray-500">No {group.title.toLowerCase()} categories.</li>
			{/each}
		</ul>
	{/each}
</section>
