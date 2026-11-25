<!--
	@component
	Phones: a bottom sheet with both expense filters. Ticking applies at once; "Show N expenses"
	just closes it. Swipe the handle or title bar down to close it (let go early and it springs
	back), or tap outside, the ×, or press Escape.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import { Dialog } from 'bits-ui';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import FilterOptionRow from './FilterOptionRow.svelte';
	import type { ExpenseFilters, FilterKind, FilterOption } from './filters.ts';

	let {
		open = $bindable(false),
		options,
		filters,
		resultCount,
		onToggle,
		onClear
	}: {
		open: boolean;
		options: Record<FilterKind, FilterOption[]>;
		filters: ExpenseFilters;
		/** Expenses the current filters show, for the close button. */
		resultCount: number;
		onToggle: (kind: FilterKind, id: string) => void;
		onClear: () => void;
	} = $props();

	const SECTIONS: { kind: FilterKind; title: string }[] = [
		{ kind: 'categories', title: 'Category' },
		{ kind: 'methods', title: 'Paid with' }
	];

	let motion = $derived({
		y: prefersReducedMotion.current ? 0 : 400,
		duration: prefersReducedMotion.current ? 0 : 250,
		easing: cubicOut
	});

	// ---- Swipe down to close ----
	// Pulled down past a quarter of its height, or flicked down, closes it; otherwise it springs back.
	let sheetHeight = $state(0);
	let dragY = $state(0);
	let dragging = $state(false);
	let startY = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocity = 0; // px per ms, downward positive

	function onpointerdown(event: PointerEvent) {
		if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
		dragging = true;
		startY = lastY = event.clientY;
		lastTime = event.timeStamp;
		velocity = 0;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}
	function onpointermove(event: PointerEvent) {
		if (!dragging) return;
		dragY = Math.max(0, event.clientY - startY);
		const elapsed = event.timeStamp - lastTime;
		if (elapsed > 0) velocity = (event.clientY - lastY) / elapsed;
		lastY = event.clientY;
		lastTime = event.timeStamp;
	}
	function onpointerup() {
		if (!dragging) return;
		dragging = false;
		if (dragY > sheetHeight / 4 || (dragY > 10 && velocity > 0.5)) open = false;
		else dragY = 0;
	}

	function onOpenChange(isOpen: boolean) {
		if (isOpen) dragY = 0;
	}
</script>

<Dialog.Root bind:open {onOpenChange}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-50 bg-black/40"
			style="opacity: {sheetHeight ? 1 - Math.min(dragY / sheetHeight, 1) : 1}"
		/>
		<Dialog.Content
			forceMount
			class="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-gray-200 bg-white text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			{#snippet child({ props, open: isOpen })}
				{#if isOpen}
					<div
						{...props}
						bind:offsetHeight={sheetHeight}
						style:transform={dragY ? `translateY(${dragY}px)` : undefined}
						class={[props.class, !dragging && 'transition-transform duration-200 ease-out']}
						transition:fly={motion}
					>
						<!-- Drag area: the handle and title bar. Touch/mouse only; keyboard and screen
						     reader users close it with Escape or the × button. -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="cursor-grab touch-none select-none active:cursor-grabbing"
							{onpointerdown}
							{onpointermove}
							{onpointerup}
							onpointercancel={onpointerup}
						>
							<div
								class="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600"
								aria-hidden="true"
							></div>
							<div class="flex items-center justify-between px-4 pt-2 pb-1">
								<Dialog.Title class="text-base font-semibold">Filters</Dialog.Title>
								<Dialog.Close
									class="-mr-2 rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
									aria-label="Close"
								>
									<X class="size-5" aria-hidden="true" />
								</Dialog.Close>
							</div>
						</div>
						<!-- No scrollbar: an always-visible one (desktop browsers) takes space on the right
						     only and pushes the rows off-centre. Phones only show one while scrolling, and
						     the half-cut last row shows there's more. -->
						<div
							class="min-h-0 flex-1 [scrollbar-width:none] overflow-y-auto overscroll-contain px-2 pb-2"
						>
							{#each SECTIONS as section (section.kind)}
								{#if options[section.kind].length > 0}
									<section class="pt-2">
										<h3
											class="px-2 pb-1 text-xs font-semibold tracking-wide text-gray-500 uppercase"
										>
											{section.title}
										</h3>
										<div role="group" aria-label={section.title}>
											{#each options[section.kind] as option (option.id)}
												<FilterOptionRow
													{option}
													checked={filters[section.kind].has(option.id)}
													onToggle={() => onToggle(section.kind, option.id)}
													touch
												/>
											{/each}
										</div>
									</section>
								{/if}
							{/each}
						</div>
						<div
							class="flex items-center gap-2 border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-gray-700"
						>
							<button
								type="button"
								class="rounded-md px-3 py-2.5 text-sm text-gray-600 disabled:opacity-40 dark:text-gray-400"
								disabled={filters.categories.size === 0 && filters.methods.size === 0}
								onclick={onClear}
							>
								Clear
							</button>
							<Dialog.Close
								class="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-900 px-3 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
							>
								<Check class="size-4" aria-hidden="true" />
								Show {resultCount}
								{resultCount === 1 ? 'expense' : 'expenses'}
							</Dialog.Close>
						</div>
					</div>
				{/if}
			{/snippet}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
