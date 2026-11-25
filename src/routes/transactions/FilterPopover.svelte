<!--
	@component
	Wider screens: one filter as a dropdown button ("Category ▾"). The button turns dark and names
	what's ticked ("Dining out +1"). A search box appears once there are more than 8 options.
-->
<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import { Popover } from 'bits-ui';
	import FilterOptionRow from './FilterOptionRow.svelte';
	import { FILTER_BUTTON, filterSummary, type FilterOption } from './filters.ts';

	let {
		name,
		options,
		ticked,
		onToggle,
		onClear
	}: {
		name: string;
		options: FilterOption[];
		ticked: ReadonlySet<string>;
		onToggle: (id: string) => void;
		onClear: () => void;
	} = $props();

	const SEARCH_FROM = 8;
	let query = $state('');
	let shown = $derived(
		query
			? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
			: options
	);
</script>

<Popover.Root onOpenChange={(open) => open && (query = '')}>
	<Popover.Trigger class={FILTER_BUTTON} data-active={ticked.size > 0 || undefined}>
		{#if ticked.size > 0}<span class="sr-only">{name}:</span>{/if}
		<span class="max-w-44 truncate">{filterSummary(options, ticked, name)}</span>
		<ChevronDown class="size-3.5 opacity-60" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			sideOffset={6}
			align="start"
			collisionPadding={8}
			class="z-50 flex w-72 flex-col rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			{#if options.length > SEARCH_FROM}
				<div class="flex items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-700">
					<Search class="size-4 text-gray-400" aria-hidden="true" />
					<input
						bind:value={query}
						placeholder="Search {name.toLowerCase()}"
						aria-label="Search {name.toLowerCase()}"
						class="w-full border-0 bg-transparent px-0 py-2 text-sm focus:ring-0"
					/>
				</div>
			{/if}
			<div class="max-h-80 overflow-y-auto p-1" role="group" aria-label={name}>
				{#each shown as option (option.id)}
					<FilterOptionRow
						{option}
						checked={ticked.has(option.id)}
						onToggle={() => onToggle(option.id)}
					/>
				{:else}
					<p class="px-2 py-3 text-sm text-gray-500">No matches.</p>
				{/each}
			</div>
			{#if ticked.size > 0}
				<div class="flex justify-end border-t border-gray-200 p-1 dark:border-gray-700">
					<button
						type="button"
						class="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
						onclick={onClear}
					>
						Clear {name.toLowerCase()}
					</button>
				</div>
			{/if}
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
