// Svelte 5 (runes) wrapper around @tanstack/virtual-core. TanStack's own Svelte adapter is
// still store-based, so this does the small amount of glue directly.
//
//   const v = createElementVirtualizer(() => ({
//   	count: rows.length,
//   	getScrollElement: () => scrollEl,
//   	estimateSize: () => 32
//   }));
//   {#each v.items as item (item.key)} … style="transform: translateY({item.start}px)" …
//
// Must be called during component initialisation (it uses $effect).

import { untrack } from 'svelte';
import {
	Virtualizer,
	elementScroll,
	observeElementOffset,
	observeElementRect,
	observeWindowOffset,
	observeWindowRect,
	windowScroll,
	type PartialKeys,
	type VirtualizerOptions
} from '@tanstack/virtual-core';

type Options<S extends Element | Window, I extends Element> = PartialKeys<
	VirtualizerOptions<S, I>,
	'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
>;

function createVirtualizerBase<S extends Element | Window, I extends Element>(
	getOptions: () => VirtualizerOptions<S, I>
) {
	// Bumped whenever TanStack reports a change, so getters below re-run in templates.
	let version = $state(0);

	const resolve = (): VirtualizerOptions<S, I> => {
		const options = getOptions();
		return {
			...options,
			onChange: (instance, sync) => {
				version++;
				options.onChange?.(instance, sync);
			}
		};
	};

	const instance = new Virtualizer<S, I>(resolve());

	// Re-apply options after mount and whenever anything they read changes (row count,
	// scroll element, …). Order matches TanStack's React adapter: update, then mount.
	$effect(() => {
		const options = resolve();
		options.getScrollElement(); // track the bound element so this re-runs once it exists
		instance.setOptions(options);
		instance._willUpdate();
		untrack(() => version++);
	});
	$effect(() => instance._didMount());

	// Hand TanStack the current options before every read, like the React adapter does on each
	// render. Without this, when the row count shrinks (e.g. after deleting rows) the template
	// re-renders with the new rows before the effect above runs, and gets items for indexes that
	// no longer exist.
	const sync = () => {
		void version;
		instance.setOptions(resolve());
	};

	return {
		instance,
		/** The rows to render right now. */
		get items() {
			sync();
			return instance.getVirtualItems();
		},
		/** Total height of all rows, for the spacer element. */
		get totalSize() {
			sync();
			return instance.getTotalSize();
		},
		/** Attach to a rendered row (with `data-index`) to measure its real height. */
		measure: (node: I) => instance.measureElement(node)
	};
}

/** Virtualize rows inside a scrolling element. */
export function createElementVirtualizer<S extends Element, I extends Element = HTMLElement>(
	getOptions: () => Options<S, I>
) {
	return createVirtualizerBase<S, I>(() => ({
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		...getOptions()
	}));
}

/** Virtualize rows that scroll with the page. */
export function createWindowVirtualizer<I extends Element = HTMLElement>(
	getOptions: () => Omit<Options<Window, I>, 'getScrollElement'>
) {
	return createVirtualizerBase<Window, I>(() => ({
		getScrollElement: () => (typeof window === 'undefined' ? null : window),
		observeElementRect: observeWindowRect,
		observeElementOffset: observeWindowOffset,
		scrollToFn: windowScroll,
		...getOptions()
	}));
}
