<!--
	@component
	One tickable filter option: checkbox, icon, name, and how many rows it would match. Options
	that match nothing are greyed but can still be ticked. `touch` = phone sizing (44px rows).
-->
<script lang="ts">
	import FilterOptionIcon from './FilterOptionIcon.svelte';
	import type { FilterOption } from './filters.ts';

	let {
		option,
		checked,
		onToggle,
		touch = false
	}: { option: FilterOption; checked: boolean; onToggle: () => void; touch?: boolean } = $props();
</script>

<label
	class={[
		'flex cursor-pointer items-center gap-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800',
		touch ? 'min-h-11 px-2 py-2' : 'px-2 py-1.5 text-sm',
		option.count === 0 && !checked && 'text-gray-400 dark:text-gray-500'
	]}
>
	<input
		type="checkbox"
		class={[
			'rounded border-gray-300 text-gray-900 focus:ring-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100',
			touch ? 'size-5' : 'size-4'
		]}
		{checked}
		onchange={onToggle}
	/>
	<FilterOptionIcon icon={option.icon} class={touch ? 'size-5' : 'size-4'} />
	<span class="min-w-0 flex-1 truncate">
		{option.label}
		{#if option.detail}<span class="text-xs text-gray-500 tabular-nums">{option.detail}</span>{/if}
	</span>
	<span class="shrink-0 text-xs text-gray-400 tabular-nums" aria-label="{option.count} matching"
		>{option.count}</span
	>
</label>
