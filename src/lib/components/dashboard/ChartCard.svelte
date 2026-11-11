<!--
	@component
	Card around one home page chart: title, optional subtitle, the chart, and an optional
	"Show as table" view with the same numbers (so nothing is only readable by colour or hover).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		subtitle,
		children,
		table,
		actions,
		class: className = ''
	}: {
		title: string;
		subtitle?: string;
		children: Snippet;
		table?: Snippet;
		/** Controls on the right of the title (e.g. a view switch). */
		actions?: Snippet;
		class?: string;
	} = $props();
</script>

<section
	class="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800 {className}"
>
	<header class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<h2 class="text-sm font-medium">{title}</h2>
			{#if subtitle}<p class="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>{/if}
		</div>
		{#if actions}{@render actions()}{/if}
	</header>
	{@render children()}
	{#if table}
		<details class="text-xs">
			<summary
				class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
			>
				Show as table
			</summary>
			<div class="mt-2 overflow-x-auto">{@render table()}</div>
		</details>
	{/if}
</section>
