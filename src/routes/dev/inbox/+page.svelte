<!--
	Mock of the quick-add inbox. Tap Quick add, then paste a bank alert or type
	a shorthand like "5.06 apple card snacks"; it lands in the inbox, and tapping a category adds
	it as an expense. Nothing counts toward totals until then.

	Cards that need a look come first: messages CentJar couldn't read, possible duplicates, and
	ones with no card or only a guessed category. "Add all ready" adds the rest in one go.

	Sample data and local state only (see +page.server.ts). Nothing is saved; reload to start over.
-->
<script lang="ts">
	import { flip } from 'svelte/animate';
	import { prefersReducedMotion } from 'svelte/motion';
	import { slide } from 'svelte/transition';
	import { toast } from 'svelte-sonner';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Check from '@lucide/svelte/icons/check';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ClipboardPaste from '@lucide/svelte/icons/clipboard-paste';
	import Zap from '@lucide/svelte/icons/zap';
	import CopyCheck from '@lucide/svelte/icons/copy';
	import FileQuestion from '@lucide/svelte/icons/file-question';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Info from '@lucide/svelte/icons/info';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Repeat from '@lucide/svelte/icons/repeat';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Dialog } from 'bits-ui';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import BudgetCard from '#lib/components/dashboard/BudgetCard.svelte';
	import CashFlowCard from '#lib/components/dashboard/CashFlowCard.svelte';
	import CategorySpending from '#lib/components/dashboard/CategorySpending.svelte';
	import CreditCardsCard from '#lib/components/dashboard/CreditCardsCard.svelte';
	import MonthlyChart from '#lib/components/dashboard/MonthlyChart.svelte';
	import PaceChart from '#lib/components/dashboard/PaceChart.svelte';
	import RecentExpensesCard, {
		type RecentItem
	} from '#lib/components/dashboard/RecentExpensesCard.svelte';
	import StatTiles from '#lib/components/dashboard/StatTiles.svelte';
	import UpcomingRecurringCard from '#lib/components/dashboard/UpcomingRecurringCard.svelte';
	import { formatMonth } from '#lib/date-range.ts';
	import { categoryIcon } from '#lib/category-icons.ts';
	import { Temporal, type PlainDate } from '#lib/dates.ts';
	import { formatCents } from '#lib/money.ts';
	import { last4Label } from '#lib/payment-methods.ts';
	import type { PageProps } from './$types';
	import type { MockExpense } from './+page.server';
	import { parseMessage, type ParseContext, type Parsed } from './parse';

	let { data }: PageProps = $props();

	// The sample data never changes while the page is open, so read it once.
	// svelte-ignore state_referenced_locally
	const { categories, paymentMethods, rules, existing, seed } = data;
	// svelte-ignore state_referenced_locally
	const today = Temporal.PlainDate.from(data.today);
	const ctx: ParseContext = { categories, paymentMethods, rules, today };
	const categoryById = new Map(categories.map((c) => [c.id, c]));
	const methodById = new Map(paymentMethods.map((m) => [m.id, m]));

	type Item = {
		id: string;
		raw: string;
		received: string;
		parsed: Parsed;
		name: string;
		amountCents: number | null;
		date: PlainDate | null;
		paymentMethodId: string | null;
		showRaw: boolean;
		showAllCategories: boolean;
		/** Just added from the quick-add box: outlined for a moment so it's easy to spot. */
		fresh: boolean;
		/** Category picked in the edit form; goes first among the suggestions. */
		categoryId: string | null;
	};

	let nextId = 0;
	function makeItem(raw: string, received: string, id = `m${nextId++}`): Item {
		const parsed = parseMessage(raw, ctx);
		return {
			id,
			raw,
			received,
			parsed,
			name: parsed.ok ? parsed.name : '',
			amountCents: parsed.ok ? parsed.amountCents : null,
			date: parsed.ok ? parsed.date : null,
			paymentMethodId: parsed.ok ? parsed.paymentMethodId : null,
			showRaw: !parsed.ok,
			showAllCategories: false,
			fresh: false,
			categoryId: null
		};
	}

	/** Needs a look first: unreadable, then possible duplicates and missing details, then ready. */
	function rank(item: Item): number {
		if (!item.parsed.ok) return 0;
		return isReady(item) ? 2 : 1;
	}

	function seedItems(): Item[] {
		return seed
			.map((m) => makeItem(m.raw, m.received))
			.sort((a, b) => rank(a) - rank(b) || compareDates(b.date, a.date));
	}

	/** Expenses added from the inbox this session (the mock's stand-in for the expense table).
	 *  Declared before `items`: sorting the seed checks for duplicates against it. */
	let added = $state<MockExpense[]>([]);
	let items = $state<Item[]>(seedItems());
	let scenario = $state<'sample' | 'empty'>('sample');
	/** Mock-only: what Quick add does. "sheet" opens a review sheet where it can be added right away
	 *  (or saved for later); "inbox" drops it straight into the inbox. */
	let pasteStyle = $state<'sheet' | 'inbox'>('sheet');
	/** Which page is showing. */
	let view = $state<'home' | 'inbox'>('home');

	// Home page around the inbox (sample numbers, real components).
	// svelte-ignore state_referenced_locally
	const home = data.home;
	const thisMonthLabel = formatMonth(home.month);
	/** How many inbox items the Home preview names. */
	const PREVIEW_LIMIT = 3;

	/** Recent Expenses on Home includes what was just added from the inbox, as it would. */
	const recent: RecentItem[] = $derived(
		[
			...added.map((e) => {
				const c = categoryById.get(e.categoryId);
				const m = e.paymentMethodId ? methodById.get(e.paymentMethodId) : undefined;
				return {
					id: e.id,
					kind: 'expense' as const,
					name: e.name,
					date: Temporal.PlainDate.from(e.date),
					amountCents: e.amountCents,
					categoryName: c?.name ?? '',
					categoryIcon: c?.icon ?? null,
					paymentMethodKind: m?.kind ?? null,
					paymentMethodName: m?.name ?? null,
					recurring: false
				};
			}),
			...home.recent
		]
			.sort((a, b) => Temporal.PlainDate.compare(b.date, a.date))
			.slice(0, 8)
	);

	function openInboxPage() {
		view = 'inbox';
		window.scrollTo({ top: 0 });
	}

	function compareDates(a: PlainDate | null, b: PlainDate | null) {
		if (!a || !b) return a ? 1 : b ? -1 : 0;
		return Temporal.PlainDate.compare(a, b);
	}

	function when(d: PlainDate): string {
		const days = d.until(today).days;
		if (days === 0) return 'Today';
		if (days === 1) return 'Yesterday';
		if (days > 1 && days < 7) return d.toLocaleString('en-US', { weekday: 'short' });
		return d.toLocaleString('en-US', { month: 'short', day: 'numeric' });
	}

	function methodLabel(id: string | null): string {
		const m = id ? methodById.get(id) : undefined;
		if (!m) return '';
		return m.last4 ? `${m.name} ${last4Label(m.last4)}` : m.name;
	}

	/** Same amount on the same card within a day of an expense already in CentJar. */
	function duplicateOf(item: Item): MockExpense | null {
		const { amountCents, date, paymentMethodId } = item;
		if (amountCents === null || !date || !paymentMethodId) return null;
		return (
			[...added, ...existing].find(
				(e) =>
					e.amountCents === amountCents &&
					e.paymentMethodId === paymentMethodId &&
					Math.abs(Temporal.PlainDate.from(e.date).until(date).days) <= 1
			) ?? null
		);
	}

	function hasDetails(item: Item) {
		return item.amountCents !== null && item.date !== null && item.name.trim() !== '';
	}

	function isReady(item: Item): boolean {
		return (
			item.parsed.ok &&
			hasDetails(item) &&
			item.paymentMethodId !== null &&
			item.parsed.categoryFrom === 'rule' &&
			!duplicateOf(item)
		);
	}

	function suggestionsFor(item: Item): string[] {
		const ids = item.parsed.ok ? item.parsed.suggestions : categories.map((c) => c.id);
		const picked = item.categoryId;
		return picked ? [picked, ...ids.filter((id) => id !== picked)] : ids;
	}

	const readyItems = $derived(items.filter(isReady));

	/** One line on the Home preview saying what an item needs. */
	function blurb(item: Item): { text: string; warn: boolean } {
		if (!item.parsed.ok && item.amountCents === null)
			return { text: "Couldn't read this message", warn: true };
		const dup = duplicateOf(item);
		if (dup) return { text: `Possible duplicate of ${dup.name}`, warn: true };
		const category = categoryById.get(suggestionsFor(item)[0])?.name;
		if (!item.paymentMethodId) return { text: `Needs a card · ${category}?`, warn: false };
		if (isReady(item)) return { text: `Ready as ${category}`, warn: false };
		return { text: `${category}? Check the category`, warn: false };
	}
	const motion = $derived(prefersReducedMotion.current ? 0 : 200);

	// ---------------------------------------------------------------------------------------------
	// Actions

	function remove(item: Item) {
		const index = items.findIndex((i) => i.id === item.id);
		items = items.filter((i) => i.id !== item.id);
		return () => {
			items = [...items.slice(0, index), item, ...items.slice(index)];
		};
	}

	function toExpense(item: Item, categoryId: string): MockExpense {
		return {
			id: item.id,
			name: item.name.trim() || 'Untitled',
			amountCents: item.amountCents ?? 0,
			date: (item.date ?? today).toString(),
			paymentMethodId: item.paymentMethodId,
			categoryId,
			recurring: false
		};
	}

	function confirm(item: Item, categoryId: string) {
		if (!hasDetails(item)) return;
		const expense = toExpense(item, categoryId);
		const restore = remove(item);
		added = [expense, ...added];
		toast.success(`Added ${expense.name}, ${formatCents(expense.amountCents)}`, {
			description: categoryById.get(categoryId)?.name,
			action: {
				label: 'Undo',
				onClick: () => {
					added = added.filter((e) => e.id !== expense.id);
					restore();
				}
			}
		});
	}

	function reject(item: Item) {
		const restore = remove(item);
		toast('Removed from the inbox', { action: { label: 'Undo', onClick: restore } });
	}

	function addAllReady() {
		const batch = readyItems.map((item) => ({
			item,
			expense: toExpense(item, suggestionsFor(item)[0])
		}));
		if (!batch.length) return;
		const before = items;
		const ids = new Set(batch.map((b) => b.item.id));
		items = items.filter((i) => !ids.has(i.id));
		added = [...batch.map((b) => b.expense), ...added];
		toast.success(`Added ${batch.length} expense${batch.length === 1 ? '' : 's'}`, {
			action: {
				label: 'Undo',
				onClick: () => {
					added = added.filter((e) => !ids.has(e.id));
					items = before;
				}
			}
		});
	}

	function setScenario(value: 'sample' | 'empty') {
		scenario = value;
		items = value === 'empty' ? [] : seedItems();
		added = [];
	}

	// ---------------------------------------------------------------------------------------------
	// Quick add

	let text = $state('');
	let textarea: HTMLTextAreaElement | undefined = $state();
	let inboxHeading: HTMLElement | undefined = $state();
	const lines = $derived(
		text
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean)
	);
	const preview = $derived(lines.length === 1 ? parseMessage(lines[0], ctx) : null);

	function addToInbox(source: string) {
		const fresh = source
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean)
			.map((l) => ({ ...makeItem(l, 'Just now'), fresh: true }));
		if (!fresh.length) return;
		items = [...fresh, ...items];
		const ids = new Set(fresh.map((f) => f.id));
		setTimeout(() => {
			for (const item of items) if (ids.has(item.id)) item.fresh = false;
		}, 2500);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		addToInbox(text);
		text = '';
	}

	/**
	 * The clipboard, only if the browser lets the page read it without asking. Reading it
	 * otherwise makes Safari (and iOS) show its own "Paste" bubble first: the extra tap this
	 * avoids. Chrome says "granted" once the site has been allowed; Safari can't be asked, so
	 * this returns '' there and the user pastes into the box themselves.
	 */
	async function clipboardIfAllowed(): Promise<string> {
		try {
			const status = await navigator.permissions?.query({
				name: 'clipboard-read' as PermissionName
			});
			if (status?.state !== 'granted') return '';
			return (await navigator.clipboard.readText()).trim();
		} catch {
			return '';
		}
	}

	/** Asks for the clipboard outright (Safari shows its "Paste" bubble). Only from the sheet's own
	 *  "Paste from clipboard" button, where the user chose it. */
	async function pasteIntoSheet() {
		try {
			const clip = (await navigator.clipboard.readText()).trim();
			if (clip) sheetText = clip;
			else toast('The clipboard is empty.');
		} catch {
			toast("Couldn't read the clipboard. Paste into the box instead.");
		}
	}

	/** Quick add on Home or the inbox page. "sheet": opens the sheet right away, filled in when the
	 *  clipboard can be read without a prompt, otherwise empty and ready to paste or type into.
	 *  "inbox": reads the clipboard (with Safari's bubble) straight into the inbox. */
	async function pasteFromClipboard() {
		if (pasteStyle === 'sheet') {
			openSheet('');
			const clip = await clipboardIfAllowed();
			if (clip && !sheetText) sheetText = clip;
			return;
		}
		let clip = '';
		try {
			clip = await navigator.clipboard.readText();
		} catch {
			// Blocked or not allowed.
		}
		if (!clip.trim()) {
			toast("Couldn't read the clipboard. Paste into the box instead.");
			openInboxPage();
			return;
		}
		addToInbox(clip);
		openInboxPage();
	}

	// ---------------------------------------------------------------------------------------------
	// Review sheet: paste or type, see what CentJar read, add it now or save it for later.

	let sheetOpen = $state(false);
	let sheetText = $state('');
	/** Card picked in the sheet when the message didn't name one. */
	let sheetMethod = $state<string | null>(null);
	let sheetShowAll = $state(false);
	const sheetLines = $derived(
		sheetText
			.split(/\n+/)
			.map((l) => l.trim())
			.filter(Boolean)
	);
	/** What the sheet would add (one message only; several go to the inbox together). */
	const sheetItem = $derived.by(() => {
		if (sheetLines.length !== 1) return null;
		const item = makeItem(sheetLines[0], 'Just now', 'sheet');
		if (!item.paymentMethodId) item.paymentMethodId = sheetMethod;
		return item;
	});

	function openSheet(text: string) {
		sheetText = text;
		sheetMethod = null;
		sheetShowAll = false;
		sheetOpen = true;
	}

	function addFromSheet(categoryId: string) {
		const item = sheetItem;
		if (!item || !hasDetails(item)) return;
		const expense = toExpense({ ...item, id: `m${nextId++}` }, categoryId);
		added = [expense, ...added];
		sheetOpen = false;
		toast.success(`Added ${expense.name}, ${formatCents(expense.amountCents)}`, {
			description: categoryById.get(categoryId)?.name,
			action: { label: 'Undo', onClick: () => (added = added.filter((e) => e.id !== expense.id)) }
		});
	}

	function saveSheetToInbox() {
		if (!sheetLines.length) return;
		const count = sheetLines.length;
		addToInbox(sheetLines.join('\n'));
		if (sheetMethod && count === 1 && items[0] && !items[0].paymentMethodId)
			items[0].paymentMethodId = sheetMethod;
		sheetOpen = false;
		toast(`Saved ${count === 1 ? 'it' : `${count} messages`} to the inbox`, {
			action: { label: 'Review', onClick: openInboxPage }
		});
	}

	// ---------------------------------------------------------------------------------------------
	// Editing (inline, one card at a time)

	type Draft = {
		name: string;
		amount: string;
		date: string;
		paymentMethodId: string;
		categoryId: string;
		/** Entering an unreadable message by hand: the form has everything, so it adds the
		 *  expense straight away instead of going back to the card. */
		manual: boolean;
		error: string;
	};
	let editingId = $state<string | null>(null);
	let draft = $state<Draft>({
		name: '',
		amount: '',
		date: '',
		paymentMethodId: '',
		categoryId: '',
		manual: false,
		error: ''
	});

	function startEdit(item: Item) {
		const guessed =
			item.categoryId ??
			(item.parsed.ok && item.parsed.categoryFrom ? item.parsed.suggestions[0] : null);
		editingId = item.id;
		draft = {
			name: item.name,
			amount: item.amountCents === null ? '' : (item.amountCents / 100).toFixed(2),
			date: (item.date ?? today).toString(),
			paymentMethodId: item.paymentMethodId ?? '',
			categoryId: guessed ?? '',
			manual: !item.parsed.ok && item.amountCents === null,
			error: ''
		};
	}

	function saveEdit(item: Item) {
		const money = draft.amount.trim().match(/^\$?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/);
		const cents = money
			? Number(money[1].replaceAll(',', '')) * 100 + Number((money[2] ?? '').padEnd(2, '0'))
			: 0;
		if (!draft.name.trim()) return void (draft.error = 'Give it a name.');
		if (!cents) return void (draft.error = 'Enter an amount, like 12.50.');
		let date: PlainDate;
		try {
			date = Temporal.PlainDate.from(draft.date);
		} catch {
			return void (draft.error = 'Pick a date.');
		}
		if (draft.manual && !draft.categoryId) return void (draft.error = 'Pick a category.');
		item.name = draft.name.trim();
		item.amountCents = cents;
		item.date = date;
		item.paymentMethodId = draft.paymentMethodId || null;
		item.categoryId = draft.categoryId || null;
		editingId = null;
		if (draft.manual && item.categoryId) confirm(item, item.categoryId);
	}

	// ---------------------------------------------------------------------------------------------
	// Styles

	const primary =
		'flex items-center justify-center gap-1.5 rounded-md border border-transparent bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
	const secondary =
		'press flex items-center justify-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium transition hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800';
	const ghost =
		'flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800';
	const chip = 'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition';
	const chipPlain = 'border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800';
	const chipBest =
		'border-transparent bg-gray-900 font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200';
	const field = 'w-full rounded-md border-gray-300 text-sm dark:border-gray-700 dark:bg-gray-900';
</script>

<svelte:head><title>Inbox mock</title></svelte:head>

{#snippet segmented(
	label: string,
	choices: readonly (readonly [string, string])[],
	value: string,
	set: (v: string) => void
)}
	<div class="flex flex-col gap-1">
		<span class="text-xs font-medium text-gray-500">{label}</span>
		<div
			class="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800"
			role="radiogroup"
			aria-label={label}
		>
			{#each choices as [key, text] (key)}
				<button
					type="button"
					role="radio"
					aria-checked={value === key}
					class={[
						'rounded-md px-3 py-1 text-sm',
						value === key
							? 'bg-white font-medium shadow-sm dark:bg-gray-950'
							: 'text-gray-600 dark:text-gray-400'
					]}
					onclick={() => set(key)}
				>
					{text}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<!-- Mock-only controls, above the page being mocked. -->
{#snippet mockControls()}
	<section
		class="flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 p-4 text-sm dark:border-gray-700"
	>
		<div>
			<p class="font-medium">Mock: quick add and inbox</p>
			<p class="text-xs text-gray-500 dark:text-gray-400">
				Sample data in this browser only. Nothing is saved. The cards below are the real home page
				components with made-up numbers.
			</p>
		</div>
		<div class="flex flex-wrap gap-4">
			{@render segmented(
				'What Quick add does',
				[
					['sheet', 'Opens a review sheet'],
					['inbox', 'Goes straight to the inbox']
				],
				pasteStyle,
				(v) => (pasteStyle = v as typeof pasteStyle)
			)}
			{@render segmented(
				'Inbox contents',
				[
					['sample', 'Sample messages'],
					['empty', 'Empty']
				],
				scenario,
				(v) => setScenario(v as typeof scenario)
			)}
		</div>
	</section>
{/snippet}

{#snippet quickAdd()}
	<form class="flex flex-col gap-2" onsubmit={submit}>
		<label for="quick-add" class="text-sm font-medium">Quick add</label>
		<div class="flex flex-col gap-2 sm:flex-row sm:items-start">
			<textarea
				id="quick-add"
				bind:this={textarea}
				bind:value={text}
				rows="2"
				placeholder="Paste a bank alert, or type 5.06 apple card snacks"
				class="{field} min-h-11 flex-1 resize-y"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						e.currentTarget.form?.requestSubmit();
					}
				}}></textarea>
			<div class="flex gap-2">
				<button type="button" class="{secondary} flex-1 sm:flex-none" onclick={pasteFromClipboard}>
					<ClipboardPaste class="size-4" aria-hidden="true" /> Paste
				</button>
				<button type="submit" class="{primary} flex-1 sm:flex-none" disabled={!lines.length}>
					Add to inbox
				</button>
			</div>
		</div>
		<p class="min-h-4 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
			{#if preview?.ok}
				Reads as {formatCents(preview.amountCents)} · {preview.name} · {when(
					preview.date
				)}{preview.paymentMethodId
					? ` · ${methodLabel(preview.paymentMethodId)}`
					: ' · no card'}{preview.categoryFrom
					? ` · ${categoryById.get(preview.suggestions[0])?.name}`
					: ''}
			{:else if preview}
				{preview.reason}
			{:else if lines.length > 1}
				{lines.length} messages, one per line
			{:else}
				Several alerts at once? Put one per line.
			{/if}
		</p>
	</form>
{/snippet}

{#snippet inboxCards(list: Item[], grid: boolean)}
	<ul class={grid ? 'grid items-start gap-3 lg:grid-cols-2' : 'flex flex-col gap-3'}>
		{#each list as item (item.id)}
			{@const parsed = item.parsed}
			{@const dup = duplicateOf(item)}
			{@const editing = editingId === item.id}
			{@const best = item.categoryId !== null || (parsed.ok && parsed.categoryFrom !== null)}
			{@const suggestions = suggestionsFor(item)}
			{@const shown = item.showAllCategories ? suggestions : suggestions.slice(0, 3)}
			{@const Cat = categoryIcon(categoryById.get(suggestions[0])?.icon)}
			<li
				animate:flip={{ duration: motion }}
				out:slide={{ duration: motion }}
				class={[
					'flex flex-col gap-3 rounded-lg border p-4 transition-shadow',
					'border-gray-200 dark:border-gray-800',
					item.fresh && 'ring-2 ring-(--chart-1)/50'
				]}
			>
				{#if parsed.ok || item.amountCents !== null}
					<!-- Summary: what CentJar read -->
					<div class="flex items-start gap-3">
						<span
							class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
						>
							<Cat class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
						</span>
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm font-medium">{item.name}</span>
							<span
								class="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-gray-500 dark:text-gray-400"
							>
								{#if item.date}<span>{when(item.date)}</span>{/if}
								{#if item.paymentMethodId}
									{@const m = methodById.get(item.paymentMethodId)}
									<span aria-hidden="true">·</span>
									{#if m}<PaymentMethodIcon kind={m.kind} class="size-3 shrink-0" />{/if}
									<span class="truncate">{methodLabel(item.paymentMethodId)}</span>
								{/if}
								<span aria-hidden="true">·</span>
								<span>{parsed.ok ? parsed.source : 'Entered by hand'}</span>
							</span>
						</div>
						<span class="shrink-0 text-base font-semibold tabular-nums">
							{formatCents(item.amountCents ?? 0)}
						</span>
					</div>
				{:else}
					<div class="flex items-start gap-3">
						<span
							class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
						>
							<FileQuestion class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
						</span>
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="text-sm font-medium">Couldn't read this message</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								{parsed.reason}
							</span>
						</div>
						<span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">{item.received}</span>
					</div>
				{/if}

				<!-- Why this one needs a look -->
				{#if dup || (parsed.ok && !item.paymentMethodId) || (parsed.ok && !item.categoryId && parsed.categoryFrom !== 'rule')}
					<ul class="flex flex-col gap-1 text-xs">
						{#if dup}
							<li class="flex items-start gap-1.5">
								<TriangleAlert
									class="mt-px size-3.5 shrink-0 text-(--status-warning)"
									aria-hidden="true"
								/>
								<span>
									<span class="font-medium">Possible duplicate:</span>
									{dup.name}, {formatCents(dup.amountCents)} on {when(
										Temporal.PlainDate.from(dup.date)
									)}
									is already added{#if dup.recurring}
										<Repeat class="mx-0.5 inline size-3 align-[-1px]" aria-hidden="true" /> by a recurring
										expense{/if}.
								</span>
							</li>
						{/if}
						{#if parsed.ok && !item.paymentMethodId}
							<li class="flex items-start gap-1.5 text-gray-600 dark:text-gray-400">
								<Info class="mt-px size-3.5 shrink-0" aria-hidden="true" />
								No card in the message. Pick one below or leave it blank.
							</li>
						{/if}
						{#if parsed.ok && !item.categoryId && parsed.categoryFrom === 'keyword'}
							<li class="flex items-start gap-1.5 text-gray-600 dark:text-gray-400">
								<Info class="mt-px size-3.5 shrink-0" aria-hidden="true" />
								Category is a guess from the words you typed.
							</li>
						{:else if parsed.ok && !item.categoryId && parsed.categoryFrom === null}
							<li class="flex items-start gap-1.5 text-gray-600 dark:text-gray-400">
								<Info class="mt-px size-3.5 shrink-0" aria-hidden="true" />
								New merchant. The category you pick is remembered for next time.
							</li>
						{/if}
					</ul>
				{/if}

				{#if editing}
					<!-- Inline edit -->
					<div class="grid grid-cols-2 gap-2" transition:slide={{ duration: motion }}>
						<label class="col-span-2 flex flex-col gap-1 text-xs font-medium">
							Name
							<input class={field} bind:value={draft.name} />
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium">
							Amount
							<input
								class={field}
								inputmode="decimal"
								bind:value={draft.amount}
								placeholder="0.00"
							/>
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium">
							Date
							<input class={field} type="date" bind:value={draft.date} />
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium">
							Category
							<select class={field} bind:value={draft.categoryId}>
								<option value="" disabled={draft.manual}>
									{draft.manual ? 'Choose…' : 'Decide below'}
								</option>
								{#each categories as c (c.id)}
									<option value={c.id}>{c.name}</option>
								{/each}
							</select>
						</label>
						<label class="flex flex-col gap-1 text-xs font-medium">
							Paid with
							<select class={field} bind:value={draft.paymentMethodId}>
								<option value="">Not recorded</option>
								{#each paymentMethods as m (m.id)}
									<option value={m.id}>{methodLabel(m.id)}</option>
								{/each}
							</select>
						</label>
						{#if draft.error}
							<p class="col-span-2 text-xs text-(--status-critical)" role="alert">
								{draft.error}
							</p>
						{/if}
						<div class="col-span-2 flex justify-end gap-2">
							<button type="button" class={secondary} onclick={() => (editingId = null)}>
								Cancel
							</button>
							<button type="button" class={primary} onclick={() => saveEdit(item)}>
								{draft.manual ? 'Add expense' : 'Save'}
							</button>
						</div>
					</div>
				{:else if hasDetails(item)}
					<!-- Card picker, only when the message didn't say -->
					{#if !item.paymentMethodId}
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Paid with</span>
							{#each paymentMethods as m (m.id)}
								<button
									type="button"
									class="{chip} {chipPlain} py-1 text-xs"
									onclick={() => (item.paymentMethodId = m.id)}
								>
									<PaymentMethodIcon kind={m.kind} class="size-3.5" />
									{m.name}
								</button>
							{/each}
						</div>
					{/if}

					<!-- Tap a category to add it -->
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Add as</span>
						{#each shown as id, i (id)}
							{@const c = categoryById.get(id)}
							{#if c}
								{@const Icon = categoryIcon(c.icon)}
								<button
									type="button"
									class="{chip} {i === 0 && best ? chipBest : chipPlain}"
									onclick={() => confirm(item, id)}
								>
									<Icon class="size-3.5" aria-hidden="true" />
									{c.name}
								</button>
							{/if}
						{/each}
						{#if !item.showAllCategories && suggestions.length > 3}
							<button
								type="button"
								class="{chip} {chipPlain} text-gray-600 dark:text-gray-400"
								onclick={() => (item.showAllCategories = true)}
							>
								More
							</button>
						{/if}
					</div>
				{/if}

				<!-- Footer: original message and the other actions -->
				<div class="flex flex-wrap items-center justify-between gap-2">
					<button
						type="button"
						class={ghost}
						aria-expanded={item.showRaw}
						onclick={() => (item.showRaw = !item.showRaw)}
					>
						<ChevronDown
							class={['size-3.5 transition-transform', item.showRaw && 'rotate-180']}
							aria-hidden="true"
						/>
						{item.showRaw ? 'Hide' : 'Show'} message
					</button>
					{#if !editing}
						<div class="flex items-center gap-1">
							{#if !parsed.ok && item.amountCents === null}
								<button type="button" class={ghost} onclick={() => startEdit(item)}>
									<Pencil class="size-3.5" aria-hidden="true" /> Enter by hand
								</button>
								<button type="button" class={ghost} onclick={() => reject(item)}>
									<X class="size-3.5" aria-hidden="true" /> Dismiss
								</button>
							{:else}
								<button type="button" class={ghost} onclick={() => startEdit(item)}>
									<Pencil class="size-3.5" aria-hidden="true" /> Edit
								</button>
								<button type="button" class={ghost} onclick={() => reject(item)}>
									<X class="size-3.5" aria-hidden="true" />
									{dup ? 'Remove duplicate' : 'Reject'}
								</button>
							{/if}
						</div>
					{/if}
				</div>
				{#if item.showRaw}
					<div
						class="flex flex-col gap-1 rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-900"
						transition:slide={{ duration: motion }}
					>
						<span class="text-gray-500 dark:text-gray-400">Received {item.received}</span>
						<p class="break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
							{item.raw}
						</p>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet countBadge()}
	{#if items.length}
		<span
			class="min-w-5 rounded-full bg-gray-900 px-1.5 text-center text-xs leading-5 font-semibold text-white tabular-nums dark:bg-white dark:text-gray-900"
		>
			{items.length}
		</span>
	{/if}
{/snippet}

{#if view === 'home'}
	<AppHeader name="Sample User" home inboxCount={items.length} onInbox={openInboxPage} />

	<main class="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-2 pb-6 sm:px-6">
		{@render mockControls()}

		<!-- Quick actions, as on the home page, plus Quick add. On a phone the row spans the same
		     width as the cards below (each button grows to share the space) and says
		     "Transactions" instead of "View transactions"; from `sm` up they sit at the left at
		     their natural size. Wraps on very narrow screens rather than overflowing. -->
		<div class="flex flex-wrap items-center gap-2 sm:justify-start sm:gap-3">
			<button
				type="button"
				class="{primary} grow whitespace-nowrap sm:grow-0"
				onclick={() => toast('Opens the existing Add dialog.')}
			>
				<Plus class="size-4" aria-hidden="true" />
				Add
			</button>
			<button
				type="button"
				class="{secondary} grow whitespace-nowrap sm:grow-0"
				onclick={pasteFromClipboard}
			>
				<Zap class="size-4" aria-hidden="true" /> Quick add
			</button>
			<button
				type="button"
				class="{secondary} grow whitespace-nowrap sm:grow-0"
				onclick={() => toast('Goes to Transactions.')}
			>
				<span class="sm:hidden">Transactions</span>
				<span class="hidden sm:inline">View transactions</span>
			</button>
		</div>

		<!-- Inbox preview: the first few items with what each needs. Hidden when it's empty. -->
		{#if items.length}
			<section
				class="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
				aria-labelledby="home-inbox-title"
			>
				<header class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 id="home-inbox-title" class="flex items-center gap-2 text-sm font-medium">
							Inbox {@render countBadge()}
						</h2>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							{#if readyItems.length}
								{readyItems.length} ready to add{items.length > readyItems.length
									? `, ${items.length - readyItems.length} need a look`
									: ''}
							{:else}
								{items.length} need a look
							{/if}
						</p>
					</div>
					{#if readyItems.length}
						<button
							type="button"
							class="{secondary} shrink-0 whitespace-nowrap"
							onclick={addAllReady}
						>
							<Check class="size-4" aria-hidden="true" />
							Add {readyItems.length} ready
						</button>
					{/if}
				</header>
				<ul class="-mx-1 grid grid-cols-1 lg:grid-cols-3 lg:gap-2">
					{#each items.slice(0, PREVIEW_LIMIT) as item (item.id)}
						{@const b = blurb(item)}
						{@const unread = !item.parsed.ok && item.amountCents === null}
						{@const Icon = unread
							? FileQuestion
							: categoryIcon(categoryById.get(suggestionsFor(item)[0])?.icon)}
						<li class="min-w-0" animate:flip={{ duration: motion }}>
							<button
								type="button"
								class="flex w-full items-center gap-3 rounded-md px-1 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
								data-no-press
								onclick={openInboxPage}
							>
								<span
									class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
								>
									<Icon class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
								</span>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm">{unread ? item.raw : item.name}</span>
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
									{#if item.amountCents !== null}
										<span class="text-sm font-medium tabular-nums">
											{formatCents(item.amountCents)}
										</span>
									{/if}
									<span class="text-xs text-gray-500 dark:text-gray-400">
										{item.date ? when(item.date) : item.received}
									</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
				<button
					type="button"
					class="flex items-center gap-0.5 self-end text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					onclick={openInboxPage}
				>
					{items.length > PREVIEW_LIMIT ? `Review all ${items.length}` : 'Open inbox'}
					<ChevronRight class="size-3.5" aria-hidden="true" />
				</button>
			</section>
		{:else}
			<!-- Empty: one quiet line, so Home doesn't jump when items arrive or leave. -->
			<section
				class="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
				aria-labelledby="home-inbox-title"
			>
				<span
					class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
				>
					<Inbox class="size-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
				</span>
				<div class="min-w-0 flex-1">
					<h2 id="home-inbox-title" class="text-sm font-medium">Inbox</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						All caught up. Anything you save for later waits here.
					</p>
				</div>
				<button
					type="button"
					class="flex shrink-0 items-center gap-0.5 text-xs text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
					onclick={openInboxPage}
				>
					Open <ChevronRight class="size-3.5" aria-hidden="true" />
				</button>
			</section>
		{/if}

		<StatTiles tiles={home.tiles} />

		<div class="grid gap-4 lg:grid-cols-2">
			<CategorySpending rows={home.byCategory} slices={home.slices} subtitle={thisMonthLabel} />
			<UpcomingRecurringCard
				charges={home.upcoming.charges}
				nextLater={home.upcoming.nextLater}
				{today}
			/>
			<RecentExpensesCard items={recent} {today} />
			<BudgetCard summary={home.budgets} subtitle={thisMonthLabel} />
			<div class="lg:col-span-2">
				<CreditCardsCard
					cards={home.cards}
					{today}
					onHide={() => toast('Hides the Credit Cards card (not in the mock).')}
				/>
			</div>
			<div class="lg:col-span-2">
				<CashFlowCard flow={home.flow} range={home.flowRange} />
			</div>
			<div class="lg:col-span-2">
				<PaceChart
					points={home.pace}
					thisMonthLabel={formatMonth(home.month, { year: false })}
					lastMonthLabel={formatMonth(home.month.subtract({ months: 1 }), { year: false })}
				/>
			</div>
			<div class="lg:col-span-2"><MonthlyChart months={home.trend} /></div>
		</div>
	</main>
{:else}
	<!-- Same bar as AppHeader, but "Home" goes back to the mock's home view. -->
	<div
		class="sticky top-0 z-40 shrink-0 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90"
	>
		<header
			class="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6"
		>
			<button
				type="button"
				class="press flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
				onclick={() => (view = 'home')}
			>
				<ArrowLeft class="size-4" aria-hidden="true" />
				Home
			</button>
			<UserMenu name="Sample User" inboxCount={items.length} onInbox={openInboxPage} />
		</header>
	</div>

	<main class="mx-auto flex max-w-6xl flex-col gap-6 px-4 pt-4 pb-10 sm:px-6">
		{@render mockControls()}

		<div class="mx-auto flex w-full max-w-2xl flex-col gap-6">
			{#if pasteStyle === 'sheet'}
				<button type="button" class="{secondary} self-start" onclick={pasteFromClipboard}>
					<Zap class="size-4" aria-hidden="true" /> Quick add
				</button>
			{:else}
				{@render quickAdd()}
			{/if}

			<section class="flex flex-col gap-3" aria-labelledby="inbox-title">
				<div bind:this={inboxHeading} class="flex scroll-mt-16 items-end justify-between gap-3">
					<div>
						<h1 id="inbox-title" class="flex items-center gap-2 text-lg font-semibold">
							Inbox
							{#if items.length}
								<span class="text-sm font-normal text-gray-500 tabular-nums dark:text-gray-400">
									{items.length}
								</span>
							{/if}
						</h1>
						<p class="text-xs text-gray-500 dark:text-gray-400">
							Nothing here counts toward your totals until you add it.
						</p>
					</div>
					{#if readyItems.length}
						<button
							type="button"
							class="{secondary} shrink-0 whitespace-nowrap"
							onclick={addAllReady}
						>
							<Check class="size-4" aria-hidden="true" />
							Add {readyItems.length} ready
						</button>
					{/if}
				</div>

				{#if !items.length}
					<div
						class="flex flex-col items-center gap-2 rounded-lg border border-gray-200 px-4 py-10 text-center dark:border-gray-800"
					>
						<Inbox class="size-6 text-gray-400" aria-hidden="true" />
						<p class="text-sm font-medium">All caught up</p>
						<p class="max-w-xs text-xs text-gray-500 dark:text-gray-400">
							Tap Quick add to paste a bank alert or type something like "5.06 apple card snacks".
						</p>
					</div>
				{/if}

				{@render inboxCards(items, false)}
			</section>

			{#if added.length}
				<section class="flex flex-col gap-2" transition:slide={{ duration: motion }}>
					<h2 class="flex items-center gap-1.5 text-sm font-medium">
						<CopyCheck class="size-4 text-gray-500" aria-hidden="true" />
						Added from the inbox
					</h2>
					<ul
						class="flex flex-col rounded-lg border border-gray-200 px-3 py-1 dark:border-gray-800"
					>
						{#each added as e (e.id)}
							{@const c = categoryById.get(e.categoryId)}
							{@const Icon = categoryIcon(c?.icon)}
							<li class="flex items-center gap-3 py-2" animate:flip={{ duration: motion }}>
								<span
									class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
								>
									<Icon class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
								</span>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm">{e.name}</span>
									<span class="truncate text-xs text-gray-500 dark:text-gray-400">
										{c?.name}{e.paymentMethodId ? ` · ${methodLabel(e.paymentMethodId)}` : ''}
									</span>
								</div>
								<div class="flex shrink-0 flex-col items-end">
									<span class="text-sm font-medium tabular-nums">{formatCents(e.amountCents)}</span>
									<span class="text-xs text-gray-500 dark:text-gray-400">
										{when(Temporal.PlainDate.from(e.date))}
									</span>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</main>
{/if}

<!-- Review sheet (paste style "sheet"): what CentJar read, ready to add with one tap. -->
<Dialog.Root bind:open={sheetOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 flex-col gap-4 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<div>
				<Dialog.Title class="text-base font-semibold">Quick add</Dialog.Title>
				<Dialog.Description class="text-xs text-gray-500 dark:text-gray-400">
					A bank alert, or a shorthand like "5.06 apple card snacks".
				</Dialog.Description>
			</div>
			<textarea
				bind:value={sheetText}
				rows="3"
				aria-label="Message"
				placeholder="Paste or type here"
				class="{field} resize-y"></textarea>
			{#if !sheetText.trim()}
				<button type="button" class="{ghost} -mt-2 self-start" onclick={pasteIntoSheet}>
					<ClipboardPaste class="size-3.5" aria-hidden="true" /> Paste from clipboard
				</button>
			{/if}

			{#if sheetItem}
				{@const p = sheetItem.parsed}
				{#if p.ok}
					{@const dup = duplicateOf(sheetItem)}
					{@const suggestions = suggestionsFor(sheetItem)}
					{@const shown = sheetShowAll ? suggestions : suggestions.slice(0, 3)}
					{@const Cat = categoryIcon(categoryById.get(suggestions[0])?.icon)}
					<div class="flex items-start gap-3">
						<span
							class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
						>
							<Cat class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
						</span>
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm font-medium">{sheetItem.name}</span>
							<span class="truncate text-xs text-gray-500 dark:text-gray-400">
								{when(p.date)}{sheetItem.paymentMethodId
									? ` · ${methodLabel(sheetItem.paymentMethodId)}`
									: ''} · {p.source}
							</span>
						</div>
						<span class="shrink-0 text-base font-semibold tabular-nums">
							{formatCents(p.amountCents)}
						</span>
					</div>
					{#if dup}
						<p class="flex items-start gap-1.5 text-xs">
							<TriangleAlert
								class="mt-px size-3.5 shrink-0 text-(--status-warning)"
								aria-hidden="true"
							/>
							<span>
								<span class="font-medium">Possible duplicate:</span>
								{dup.name}, {formatCents(dup.amountCents)} on {when(
									Temporal.PlainDate.from(dup.date)
								)}
								is already added.
							</span>
						</p>
					{/if}
					{#if !p.paymentMethodId}
						<div class="flex flex-wrap items-center gap-1.5">
							<span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Paid with</span>
							{#each paymentMethods as m (m.id)}
								<button
									type="button"
									aria-pressed={sheetMethod === m.id}
									class="{chip} {sheetMethod === m.id ? chipBest : chipPlain} py-1 text-xs"
									onclick={() => (sheetMethod = sheetMethod === m.id ? null : m.id)}
								>
									<PaymentMethodIcon kind={m.kind} class="size-3.5" />
									{m.name}
								</button>
							{/each}
						</div>
					{/if}
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="mr-1 text-xs text-gray-500 dark:text-gray-400">Add as</span>
						{#each shown as id, i (id)}
							{@const c = categoryById.get(id)}
							{#if c}
								{@const Icon = categoryIcon(c.icon)}
								<button
									type="button"
									class="{chip} {i === 0 && p.categoryFrom ? chipBest : chipPlain}"
									onclick={() => addFromSheet(id)}
								>
									<Icon class="size-3.5" aria-hidden="true" />
									{c.name}
								</button>
							{/if}
						{/each}
						{#if !sheetShowAll && suggestions.length > 3}
							<button
								type="button"
								class="{chip} {chipPlain} text-gray-600 dark:text-gray-400"
								onclick={() => (sheetShowAll = true)}
							>
								More
							</button>
						{/if}
					</div>
				{:else}
					<p class="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
						<FileQuestion class="mt-px size-3.5 shrink-0" aria-hidden="true" />
						{p.reason} Save it to the inbox to enter it by hand.
					</p>
				{/if}
			{:else if sheetLines.length > 1}
				<p class="text-xs text-gray-600 dark:text-gray-400">
					{sheetLines.length} messages. Save them to the inbox to review one by one.
				</p>
			{/if}

			<div class="flex justify-end gap-2">
				<Dialog.Close type="button" class={secondary}>Cancel</Dialog.Close>
				<button
					type="button"
					class={sheetItem?.parsed.ok ? secondary : primary}
					disabled={!sheetLines.length}
					onclick={saveSheetToInbox}
				>
					{sheetLines.length > 1 ? `Save ${sheetLines.length} to inbox` : 'Save for later'}
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
