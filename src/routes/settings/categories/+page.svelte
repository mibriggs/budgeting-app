<!--
	Settings → Categories: add, rename, change icon, reorder and remove expense and income
	categories, and restore archived ones. Edits are drafts (changed rows are highlighted) until
	Save, which sends the whole list; the server works out the writes (+page.server.ts).

	Removing a category that has entries archives it (hidden from the add form and budgets; its
	entries keep it). One that was never used is deleted.
-->
<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import { Popover } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import Archive from '@lucide/svelte/icons/archive';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Undo2 from '@lucide/svelte/icons/undo-2';
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		CATEGORY_NAME_MAX,
		CHANGES_FIELD,
		NEW_CATEGORY_PREFIX,
		type CategoryChanges
	} from '#lib/category-changes.ts';
	import {
		CATEGORY_ICON_GROUPS,
		CATEGORY_ICONS,
		categoryIcon,
		isCategoryIconName,
		type CategoryIconName
	} from '#lib/category-icons.ts';
	import { categoryNameKey, tidyCategoryName } from '#lib/category-name.ts';
	import type { TransactionKind as Kind } from '#lib/server/budget/transactions.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Stored = { id: string; name: string; icon: string | null; uses: number };
	type Row = Stored & { isNew: boolean; remove: boolean };
	type ArchivedRow = Stored & { restore: boolean };
	type Draft = Record<Kind, { active: Row[]; archived: ArchivedRow[] }>;

	const KINDS: { kind: Kind; title: string }[] = [
		{ kind: 'expense', title: 'Expense' },
		{ kind: 'income', title: 'Income' }
	];

	function fresh(): Draft {
		const out = {} as Draft;
		for (const { kind } of KINDS) {
			out[kind] = {
				active: data[kind].active.map((c) => ({ ...c, isNew: false, remove: false })),
				archived: data[kind].archived.map((c) => ({ ...c, restore: false }))
			};
		}
		return out;
	}

	let draft = $state(fresh());
	// Rows the user moved themselves; only those are marked "Moved" (not every row that shifted).
	let moved = $state<Record<string, true>>({});
	let saving = $state(false);
	// Per-category messages from the save action (normally the page catches problems first),
	// and one for the whole page (e.g. it's out of date).
	let serverErrors = $state<Record<string, string>>({});
	let pageError = $state<string | null>(null);

	// Drafts reset whenever what's stored changes: on load and after a save.
	$effect.pre(() => {
		void data.expense;
		void data.income;
		untrack(() => discard());
	});

	// Stored active categories by id, with their position.
	const stored = $derived(
		Object.fromEntries(
			KINDS.flatMap(({ kind }) => data[kind].active.map((c, index) => [c.id, { ...c, index }]))
		) as Record<string, Stored & { index: number }>
	);

	const key = categoryNameKey;
	const deletes = (r: Row) => r.remove && r.uses === 0;

	type RowError = { text: string; restoreId?: string };
	function rowError(kind: Kind, row: Row): RowError | null {
		if (row.remove) return null;
		if (!tidyCategoryName(row.name)) return { text: 'Enter a name.' };
		const name = key(row.name);
		if (!name) return { text: 'Use at least one letter or number.' };
		const orig = stored[row.id];
		// Re-punctuating its own name ("Laundry" → "Laundry.") is fine.
		if (orig && key(orig.name) === name) return null;
		const other = draft[kind].active.find((r) => r !== row && !deletes(r) && key(r.name) === name);
		if (other) return { text: `You already have “${tidyCategoryName(other.name)}”.` };
		const arch = draft[kind].archived.find((a) => key(a.name) === name);
		if (arch && arch.restore) return { text: `“${arch.name}” is already being restored.` };
		if (arch) return { text: `You have an archived “${arch.name}”.`, restoreId: arch.id };
		return null;
	}

	const errors = $derived(
		Object.fromEntries(
			KINDS.flatMap(({ kind }) =>
				draft[kind].active.map((r) => {
					const server = serverErrors[r.id];
					return [r.id, rowError(kind, r) ?? (server ? { text: server } : null)];
				})
			)
		) as Record<string, RowError | null>
	);
	const errorCount = $derived(Object.values(errors).filter(Boolean).length);

	function notes(row: Row, index: number): string | null {
		if (row.isNew) return 'New';
		if (row.remove)
			return row.uses > 0
				? `Will be archived · its ${row.uses} ${row.uses === 1 ? 'entry keeps' : 'entries keep'} it`
				: 'Will be deleted · never used';
		const orig = stored[row.id];
		const parts: string[] = [];
		if (tidyCategoryName(row.name) !== orig.name) parts.push(`Was “${orig.name}”`);
		if (row.icon !== orig.icon) parts.push('new icon');
		if (moved[row.id] && index !== orig.index) parts.push('moved');
		if (parts.length === 0) return null;
		const text = parts.join(' · ');
		return text[0].toUpperCase() + text.slice(1);
	}

	const changedCount = $derived(
		KINDS.reduce(
			(sum, { kind }) =>
				sum +
				draft[kind].active.filter((r, i) => notes(r, i) !== null).length +
				draft[kind].archived.filter((a) => a.restore).length,
			0
		)
	);
	// A reorder that puts everything back where it was isn't a change.
	const orderChanged = $derived(
		KINDS.some(({ kind }) =>
			draft[kind].active.some((r, i) => !r.isNew && stored[r.id]?.index !== i)
		)
	);
	const dirty = $derived(changedCount > 0 || orderChanged);

	// What Save sends (see src/lib/category-changes.ts).
	const payload = $derived.by(() => {
		const out = {} as CategoryChanges;
		for (const { kind } of KINDS) {
			const { active, archived } = draft[kind];
			out[kind] = {
				active: active
					.filter((r) => !r.remove)
					.map((r) => ({ id: r.id, name: tidyCategoryName(r.name), icon: r.icon })),
				remove: active.filter((r) => r.remove).map((r) => r.id),
				restore: archived.filter((a) => a.restore).map((a) => a.id)
			};
		}
		return JSON.stringify(out);
	});

	function move(kind: Kind, from: number, to: number) {
		const list = draft[kind].active;
		if (to < 0 || to >= list.length || from === to) return;
		const [row] = list.splice(from, 1);
		list.splice(to, 0, row);
		moved[row.id] = true;
	}

	async function add(kind: Kind) {
		const id = `${NEW_CATEGORY_PREFIX}${crypto.randomUUID()}`;
		draft[kind].active.push({ id, name: '', icon: 'tag', uses: 0, isNew: true, remove: false });
		await tick();
		document.getElementById(`name-${id}`)?.focus();
	}

	function toggleRemove(kind: Kind, row: Row) {
		if (row.isNew) draft[kind].active = draft[kind].active.filter((r) => r !== row);
		else row.remove = !row.remove;
	}

	function restoreFromClash(kind: Kind, row: Row, archivedId: string) {
		const arch = draft[kind].archived.find((a) => a.id === archivedId);
		if (arch) arch.restore = true;
		if (row.isNew) draft[kind].active = draft[kind].active.filter((r) => r !== row);
		else row.name = stored[row.id].name;
	}

	function discard() {
		draft = fresh();
		moved = {};
		serverErrors = {};
		pageError = null;
	}

	// Drag to reorder, with pointer events so mouse, finger and pen all work the same (HTML5
	// `draggable` is patchy on phones). Only the handle starts a drag; it has touch-action: none
	// so a finger on it drags instead of scrolling the page.
	//
	// The list isn't reordered while dragging: the dragged row follows the pointer (a transform)
	// and the rows it passes slide out of its way. On release it glides into its slot, then the
	// list is reordered for real in the same frame the transforms are cleared, so nothing jumps.
	// Moves and releases are watched on the whole window, so letting go anywhere ends the drag.
	type Drag = {
		kind: Kind;
		id: string;
		from: number;
		to: number;
		/** Pointer position at the start and now, in page coordinates (so scrolling counts). */
		startY: number;
		y: number;
		/** Each row's top and height in page coordinates, measured at the start. */
		rows: { top: number; height: number }[];
		phase: 'drag' | 'drop';
	};
	let drag = $state<Drag | null>(null);
	// True for the frame the list is reordered, so the transforms clear without animating.
	let settling = $state(false);
	let lastClientY = 0;
	let scrollFrame = 0;
	const SLIDE_MS = 160;

	function dragStart(event: PointerEvent, kind: Kind, row: Row, index: number) {
		if (drag || row.remove || event.button !== 0) return;
		event.preventDefault();
		const items = [
			...((event.currentTarget as HTMLElement).closest('ul')?.children ?? [])
		] as HTMLElement[];
		const rows = items.map((li) => {
			const r = li.getBoundingClientRect();
			return { top: r.top + window.scrollY, height: r.height };
		});
		lastClientY = event.clientY;
		const y = event.clientY + window.scrollY;
		drag = { kind, id: row.id, from: index, to: index, startY: y, y, rows, phase: 'drag' };
		window.addEventListener('pointermove', dragMove);
		window.addEventListener('pointerup', dragEnd);
		window.addEventListener('pointercancel', dragEnd);
		scrollFrame = requestAnimationFrame(autoScroll);
	}

	function follow(clientY: number) {
		if (!drag || drag.phase !== 'drag') return;
		drag.y = clientY + window.scrollY;
		// Where the dragged row's middle is now, compared with the other rows' middles.
		const { rows, from } = drag;
		const middle = rows[from].top + (drag.y - drag.startY) + rows[from].height / 2;
		const mid = (i: number) => rows[i].top + rows[i].height / 2;
		let to = from;
		for (let i = from + 1; i < rows.length; i++) if (middle > mid(i)) to = i;
		for (let i = from - 1; i >= 0; i--) if (middle < mid(i)) to = i;
		drag.to = to;
	}

	function dragMove(event: PointerEvent) {
		lastClientY = event.clientY;
		follow(event.clientY);
	}

	// Scrolls while the pointer is near the top (below the sticky header) or bottom of the
	// screen, faster the closer it gets.
	function autoScroll() {
		if (!drag || drag.phase !== 'drag') return;
		const top = 56 + 48;
		const bottom = window.innerHeight - 64;
		let dy = 0;
		if (lastClientY < top) dy = -Math.ceil((top - lastClientY) / 6);
		else if (lastClientY > bottom) dy = Math.ceil((lastClientY - bottom) / 6);
		if (dy) {
			window.scrollBy(0, dy);
			follow(lastClientY);
		}
		scrollFrame = requestAnimationFrame(autoScroll);
	}

	function dragEnd() {
		window.removeEventListener('pointermove', dragMove);
		window.removeEventListener('pointerup', dragEnd);
		window.removeEventListener('pointercancel', dragEnd);
		cancelAnimationFrame(scrollFrame);
		if (!drag || drag.phase !== 'drag') return;
		drag.phase = 'drop';
		setTimeout(commitDrop, prefersReducedMotion.current ? 0 : SLIDE_MS);
	}

	function commitDrop() {
		if (!drag) return;
		const { kind, from, to } = drag;
		settling = true;
		if (from !== to) move(kind, from, to);
		drag = null;
		// Two frames: one to paint without transitions, then turn them back on.
		requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
	}

	// How far the dragged row sits from its original place once dropped into slot `to`.
	function slotOffset(d: Drag) {
		const { rows, from, to } = d;
		if (to > from) return rows[to].top + rows[to].height - rows[from].height - rows[from].top;
		return rows[to].top - rows[from].top;
	}

	/** The transform for row `i` while a drag is in progress in this list. */
	function shift(kind: Kind, i: number): string | undefined {
		if (!drag || drag.kind !== kind || settling) return undefined;
		const { from, to, rows, phase } = drag;
		if (i === from)
			return `translateY(${phase === 'drag' ? drag.y - drag.startY : slotOffset(drag)}px)`;
		if (from < to && i > from && i <= to) return `translateY(${-rows[from].height}px)`;
		if (to < from && i >= to && i < from) return `translateY(${rows[from].height}px)`;
		return undefined;
	}

	/** Transitions while dragging: the dragged row follows the pointer instantly, others slide. */
	function shiftTransition(kind: Kind, i: number): string | undefined {
		if (settling) return 'none';
		if (!drag || drag.kind !== kind) return undefined;
		const ms = prefersReducedMotion.current ? 0 : SLIDE_MS;
		const lift = `scale ${ms}ms ease-out, box-shadow ${ms}ms ease-out`;
		if (i === drag.from && drag.phase === 'drag') return lift;
		return `transform ${ms}ms ease-out, ${lift}`;
	}

	const isLifted = (id: string) => drag?.id === id && drag.phase === 'drag';

	// Leaving the page mid-drag stops listening.
	$effect(() => () => {
		window.removeEventListener('pointermove', dragMove);
		window.removeEventListener('pointerup', dragEnd);
		window.removeEventListener('pointercancel', dragEnd);
		cancelAnimationFrame(scrollFrame);
	});

	// Stored icons that aren't in the list (or none) show, and pick as, the Tag icon.
	const iconKey = (icon: string | null): CategoryIconName =>
		icon && isCategoryIconName(icon) ? icon : 'tag';
	const iconLabel = (icon: string | null) => CATEGORY_ICONS[iconKey(icon)].label;
	let openPicker = $state<string | null>(null);
	// The icon under the pointer or keyboard focus in the open picker, named in its header (phones
	// have no tooltips).
	let previewIcon = $state<CategoryIconName | null>(null);

	// Leaving with unsaved changes asks first (the browser asks on reload or closing the tab).
	beforeNavigate((navigation) => {
		if (!dirty || saving) return;
		if (navigation.type === 'leave') navigation.cancel();
		else if (!confirm('Discard your unsaved category changes?')) navigation.cancel();
	});

	const iconButton =
		'grid size-8 shrink-0 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-100';
</script>

<svelte:head>
	<title>Categories · Settings · Budget</title>
</svelte:head>

<section aria-labelledby="section-title">
	<h2 id="section-title" class="text-lg font-semibold">Categories</h2>
	<p class="text-sm text-gray-500 dark:text-gray-400">
		What you sort expenses and income into. The order here is the order in the add form. Limits and
		the Everyday setting are on
		<a
			href={resolve('/settings/budgets')}
			class="underline hover:text-gray-900 dark:hover:text-gray-100">Budgets</a
		>.
	</p>

	<form
		method="post"
		class="mt-1"
		use:enhance={({ cancel }) => {
			if (!dirty || errorCount > 0) return cancel();
			saving = true;
			const count = Math.max(changedCount, 1);
			return async ({ result, update }) => {
				saving = false;
				if (result.type === 'success') {
					toast.success(`Saved ${count} category ${count === 1 ? 'change' : 'changes'}.`);
					await update({ reset: false });
				} else if (result.type === 'failure') {
					const errs = result.data?.errors as
						{ rows: Record<string, string>; page?: string } | undefined;
					serverErrors = errs?.rows ?? {};
					pageError = errs?.page ?? null;
				} else if (result.type === 'error') {
					toast.error(
						navigator.onLine
							? 'Couldn’t save your categories. Please try again.'
							: 'You’re offline. Saving needs a connection.'
					);
				} else {
					await update();
				}
			};
		}}
	>
		<input type="hidden" name={CHANGES_FIELD} value={payload} />

		{#each KINDS as { kind, title } (kind)}
			{@const list = draft[kind].active}
			{@const archived = draft[kind].archived}
			<h3 class="mt-5 text-sm font-medium text-gray-500 dark:text-gray-400">
				{title} · {list.filter((r) => !r.remove).length}
			</h3>
			{#if list.length === 0}
				<p
					class="mt-2 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700"
				>
					No {title.toLowerCase()} categories yet.
				</p>
			{:else}
				<ul
					class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
				>
					{#each list as row, i (row.id)}
						{@const Icon = categoryIcon(row.icon)}
						{@const error = errors[row.id]}
						{@const note = notes(row, i)}
						{@const noteId = `note-${row.id}`}
						<li
							animate:flip={{ duration: prefersReducedMotion.current || settling ? 0 : 150 }}
							style:transform={shift(kind, i)}
							style:transition={shiftTransition(kind, i)}
							class={[
								'relative flex items-center gap-1 bg-white py-2 pr-2 pl-0.5 transition-[background-color,scale,box-shadow] duration-150 first:rounded-t-lg last:rounded-b-lg sm:gap-2 sm:pl-1 dark:bg-gray-950',
								error
									? 'bg-red-50! dark:bg-red-500/10!'
									: note && 'bg-amber-100/70! dark:bg-amber-400/10!',
								// The row being dragged lifts: a little bigger, with a shadow. It stays above
								// the others while it glides into place.
								drag?.id === row.id && 'z-10',
								isLifted(row.id) &&
									'scale-[1.04] rounded-lg bg-gray-50! shadow-xl ring-1 ring-gray-300 dark:bg-gray-900! dark:ring-gray-600'
							]}
						>
							<!-- Drag handle (the arrows do the same from a keyboard or screen reader). -->
							<span
								aria-hidden="true"
								onpointerdown={(event) => dragStart(event, kind, row, i)}
								class={[
									'grid h-10 w-6 shrink-0 cursor-grab touch-none place-items-center text-gray-400 select-none hover:text-gray-700 active:cursor-grabbing sm:h-8 sm:w-5 dark:hover:text-gray-200',
									row.remove && 'invisible'
								]}
							>
								<GripVertical class="size-4" />
							</span>

							<!-- Icon picker -->
							<Popover.Root
								bind:open={() => openPicker === row.id, (o) => (openPicker = o ? row.id : null)}
							>
								<Popover.Trigger
									disabled={row.remove}
									aria-label="Icon for {row.name || 'new category'}: {iconLabel(row.icon)}. Change"
									class={[
										'flex h-8 shrink-0 items-center gap-0.5 rounded-md border px-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-900',
										!row.isNew && !row.remove && row.icon !== stored[row.id]?.icon
											? 'border-amber-500 dark:border-amber-400'
											: 'border-gray-300 dark:border-gray-700'
									]}
								>
									<Icon class="size-4" aria-hidden="true" />
									<ChevronDown class="size-3 text-gray-400" aria-hidden="true" />
								</Popover.Trigger>
								<Popover.Portal>
									<Popover.Content
										sideOffset={4}
										align="start"
										collisionPadding={8}
										onOpenAutoFocus={(event) => {
											// Start on the current icon (scrolled into view), not the first one.
											event.preventDefault();
											const current = (
												event.currentTarget as HTMLElement | null
											)?.querySelector<HTMLElement>('[aria-pressed="true"]');
											current?.focus();
											current?.scrollIntoView({ block: 'nearest' });
										}}
										onCloseAutoFocus={() => (previewIcon = null)}
										class="z-50 flex max-h-[min(26rem,var(--bits-popover-content-available-height))] w-[calc(8*2.25rem+7*0.25rem+1.5rem)] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
									>
										<p
											class="border-b border-gray-100 px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400"
											aria-hidden="true"
										>
											{previewIcon ? iconLabel(previewIcon) : `Icon: ${iconLabel(row.icon)}`}
										</p>
										<div class="overflow-y-auto overscroll-contain px-3 pb-3">
											{#each CATEGORY_ICON_GROUPS as group (group.label)}
												<p
													class="sticky top-0 bg-white pt-2.5 pb-1 text-xs font-medium text-gray-600 dark:bg-gray-900 dark:text-gray-300"
												>
													{group.label}
												</p>
												<div role="group" aria-label={group.label} class="grid grid-cols-8 gap-1">
													{#each group.icons as name (name)}
														{@const Choice = CATEGORY_ICONS[name].icon}
														{@const selected = iconKey(row.icon) === name}
														<button
															type="button"
															aria-label={iconLabel(name)}
															aria-pressed={selected}
															title={iconLabel(name)}
															onpointerenter={() => (previewIcon = name)}
															onfocus={() => (previewIcon = name)}
															onclick={() => {
																// Picking Tag for a category with no icon leaves it unchanged.
																if (!(name === 'tag' && selected)) row.icon = name;
																openPicker = null;
															}}
															class={[
																'grid size-9 place-items-center rounded-md',
																selected
																	? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
																	: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
															]}
														>
															<Choice class="size-4" aria-hidden="true" />
														</button>
													{/each}
												</div>
											{/each}
										</div>
									</Popover.Content>
								</Popover.Portal>
							</Popover.Root>

							<!-- Name -->
							<div class="flex min-w-0 flex-1 flex-col">
								<input
									id="name-{row.id}"
									bind:value={row.name}
									oninput={() => {
										delete serverErrors[row.id];
										pageError = null;
									}}
									disabled={row.remove}
									maxlength={CATEGORY_NAME_MAX}
									autocomplete="off"
									placeholder="Category name"
									aria-label="Name"
									aria-invalid={error ? true : undefined}
									aria-describedby={error || note ? noteId : undefined}
									onkeydown={(event) => {
										// Escape puts the stored name back.
										if (event.key === 'Escape' && !row.isNew) row.name = stored[row.id].name;
									}}
									onblur={() => (row.name = tidyCategoryName(row.name))}
									class={[
										'w-full rounded-md bg-white px-2.5 py-1.5 text-sm placeholder:text-gray-400 disabled:border-transparent disabled:bg-transparent disabled:text-gray-500 disabled:line-through dark:bg-gray-900 dark:disabled:bg-transparent',
										error
											? 'border-red-500'
											: !row.isNew && tidyCategoryName(row.name) !== stored[row.id]?.name
												? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500 dark:border-amber-400'
												: 'border-gray-300 focus:border-gray-500 focus:ring-gray-500 dark:border-gray-700'
									]}
								/>
								{#if error}
									<span id={noteId} class="mt-0.5 text-xs text-red-700 dark:text-red-400">
										{error.text}
										{#if error.restoreId}
											{@const restoreId = error.restoreId}
											<button
												type="button"
												onclick={() => restoreFromClash(kind, row, restoreId)}
												class="font-medium underline"
											>
												Restore it
											</button>
										{/if}
									</span>
								{:else if note}
									<span id={noteId} class="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
										{note}
									</span>
								{/if}
							</div>

							<!-- Order -->
							<button
								type="button"
								class={iconButton}
								disabled={row.remove || i === 0}
								aria-label="Move {row.name || 'new category'} up (now {i + 1} of {list.length})"
								onclick={() => move(kind, i, i - 1)}
							>
								<ArrowUp class="size-4" aria-hidden="true" />
							</button>
							<button
								type="button"
								class={iconButton}
								disabled={row.remove || i === list.length - 1}
								aria-label="Move {row.name || 'new category'} down (now {i + 1} of {list.length})"
								onclick={() => move(kind, i, i + 1)}
							>
								<ArrowDown class="size-4" aria-hidden="true" />
							</button>

							<!-- Remove / undo. Used categories archive; unused ones delete. -->
							{#if row.remove}
								<button
									type="button"
									class={iconButton}
									aria-label="Undo removing {row.name}"
									title="Undo"
									onclick={() => toggleRemove(kind, row)}
								>
									<Undo2 class="size-4" aria-hidden="true" />
								</button>
							{:else}
								{@const archives = row.uses > 0}
								<button
									type="button"
									class={[iconButton, 'hover:text-red-700! dark:hover:text-red-400!']}
									aria-label="{archives ? 'Archive' : 'Delete'} {row.name || 'new category'}"
									title={archives
										? `Archive (${row.uses} ${row.uses === 1 ? 'entry uses' : 'entries use'} it)`
										: row.isNew
											? 'Remove'
											: 'Delete (never used)'}
									onclick={() => toggleRemove(kind, row)}
								>
									{#if archives}
										<Archive class="size-4" aria-hidden="true" />
									{:else}
										<Trash2 class="size-4" aria-hidden="true" />
									{/if}
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<button
				type="button"
				onclick={() => add(kind)}
				class="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
			>
				<Plus class="size-4" aria-hidden="true" />
				Add {title.toLowerCase()} category
			</button>

			{#if archived.length > 0}
				<details class="mt-3" open={archived.some((a) => a.restore) || undefined}>
					<summary
						class="w-fit cursor-pointer rounded-md px-2 py-1 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					>
						Archived {title.toLowerCase()} categories · {archived.length}
					</summary>
					<p class="mt-1 px-2 text-xs text-gray-500 dark:text-gray-400">
						Hidden from the add form and budgets. Their entries keep the category.
					</p>
					<ul
						class="mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-dashed border-gray-300 dark:divide-gray-800 dark:border-gray-700"
					>
						{#each archived as a (a.id)}
							{@const Icon = categoryIcon(a.icon)}
							<li
								class={[
									'flex items-center gap-3 px-3 py-2',
									a.restore && 'bg-amber-100/70 dark:bg-amber-400/10'
								]}
							>
								<Icon class="size-4 shrink-0 text-gray-400" aria-hidden="true" />
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm text-gray-600 dark:text-gray-300">{a.name}</span>
									<span
										class={[
											'text-xs',
											a.restore
												? 'text-amber-800 dark:text-amber-300'
												: 'text-gray-500 dark:text-gray-400'
										]}
									>
										{a.restore
											? 'Will be restored to the end of the list'
											: `${a.uses} ${a.uses === 1 ? 'entry' : 'entries'}`}
									</span>
								</div>
								<button
									type="button"
									onclick={() => (a.restore = !a.restore)}
									aria-label="{a.restore ? 'Undo restoring' : 'Restore'} {a.name}"
									class="rounded-md border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
								>
									{a.restore ? 'Undo' : 'Restore'}
								</button>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		{/each}

		<p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
			Removing a category that has entries archives it; one that was never used is deleted. Escape
			undoes a name.
		</p>

		<!-- Appears once something changes; sticks to the bottom of the screen while scrolling. -->
		{#if dirty || errorCount > 0}
			<div
				transition:fly={{ y: 16, duration: prefersReducedMotion.current ? 0 : 200 }}
				class="sticky bottom-4 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
				role="region"
				aria-label="Unsaved changes"
			>
				<p class="text-sm" aria-live="polite">
					{#if pageError}
						<span class="text-red-700 dark:text-red-400">{pageError}</span>
					{:else if errorCount > 0}
						<span class="text-red-700 dark:text-red-400">
							Fix {errorCount === 1 ? '1 name' : `${errorCount} names`} to save.
						</span>
					{:else if changedCount === 0}
						New order
					{:else}
						{changedCount} unsaved {changedCount === 1 ? 'change' : 'changes'}
					{/if}
				</p>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={discard}
						disabled={saving}
						class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800"
					>
						Discard
					</button>
					<button
						type="submit"
						disabled={saving || errorCount > 0 || !dirty}
						class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						{saving ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		{/if}
	</form>
</section>
