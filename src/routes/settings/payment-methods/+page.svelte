<!--
	Settings → Payment methods: credit cards, debit cards and pay apps (Venmo, Zelle…), plus the
	built-in Cash. Each row shows this month's spending through it. A credit card with a closing
	date shows its current billing cycle instead (and how much of the limit that is), plus the
	next payment: "$842 due Dec 3" while the last statement is unpaid, else when the next one's due. The add/edit dialog keeps only what's needed to
	tell methods apart: never full card numbers.

	Credit cards can have a statement closing date and a payment due date, both optional, picked
	on the calendar; only the day of the month is kept and it repeats every month.
-->
<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Plus from '@lucide/svelte/icons/plus';
	import { Dialog, Select, Switch } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import DatePicker from '#lib/components/DatePicker.svelte';
	import { saveCreditCardsCard } from '#lib/home-cards.ts';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import type { PlainDate } from '#lib/dates.ts';
	import { formatCents, formatCentsWhole } from '#lib/money.ts';
	import {
		ADDABLE_KINDS,
		KIND_LABEL,
		PAYMENT_METHOD_NAME_MAX,
		last4Label,
		nextOnDay,
		parsePaymentMethod,
		UTILIZATION_WARN,
		type AddableKind,
		type PaymentMethodErrors
	} from '#lib/payment-methods.ts';
	import { ordinal } from '#lib/recurring-schedule.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Home page "Credit cards" card, saved per account as soon as the switch moves.
	// svelte-ignore state_referenced_locally
	let showCreditCards = $state(data.showCreditCards);
	async function setShowCreditCards(show: boolean) {
		showCreditCards = show;
		if (!(await saveCreditCardsCard(show))) showCreditCards = !show;
	}
	const today = $derived(data.today);
	type Row = (typeof data.methods)[number];

	const short = (d: PlainDate) => d.toLocaleString('en-US', { month: 'short', day: 'numeric' });

	// The icon already shows the kind, so cards show their last 4 digits instead when known.
	function subtitle(m: Row): string {
		if (m.kind === 'cash') return 'Always available';
		const parts = [m.last4 ? last4Label(m.last4) : KIND_LABEL[m.kind]];
		const due = m.card?.nextDue;
		if (due)
			parts.push(
				due.amountCents === null
					? `Due ${short(due.date)}`
					: `${formatCentsWhole(due.amountCents)} due ${short(due.date)}`
			);
		return parts.join(' · ');
	}

	/** Cycle spending for cards with a closing date, else this calendar month's. */
	const amountOf = (m: Row) => m.card?.cycle?.spentCents ?? m.spentCents;
	const periodOf = (m: Row) => (m.card?.cycle ? 'this cycle' : 'this month');

	const KIND_TAB: Record<AddableKind, string> = {
		credit: 'Credit',
		debit: 'Debit',
		p2p: 'Pay app'
	};
	const PLACEHOLDER: Record<AddableKind, string> = {
		credit: 'e.g. Chase Sapphire',
		debit: 'e.g. Checking',
		p2p: 'e.g. Venmo'
	};

	// --- Add / edit dialog ---

	let open = $state(false);
	let editing = $state<string | null>(null);
	let kind = $state<AddableKind>('credit');
	let name = $state('');
	let last4 = $state('');
	let limit = $state('');
	let closing = $state<PlainDate | null>(null);
	let due = $state<PlainDate | null>(null);
	let remindHour = $state('12');
	let submitted = $state(false);
	let pending = $state(false);
	let serverErrors = $state<PaymentMethodErrors>({});
	let formError = $state('');
	let confirmRemove = $state(false);

	// Checked in the browser with the same rules as the server; shown once Save is pressed.
	const parsed = $derived(
		parsePaymentMethod({
			kind,
			name,
			last4,
			limit,
			closingDay: closing ? String(closing.day) : '',
			dueDay: due ? String(due.day) : '',
			remindHour
		})
	);
	const errors = $derived<PaymentMethodErrors>(
		submitted ? { ...('errors' in parsed ? parsed.errors : {}), ...serverErrors } : serverErrors
	);

	// Picked dates can be up to a year either side of today; only their day of the month is kept.
	const dateMin = $derived(today.subtract({ years: 1 }));
	const dateMax = $derived(today.add({ years: 1 }));

	function reset() {
		submitted = false;
		pending = false;
		serverErrors = {};
		formError = '';
		confirmRemove = false;
	}

	function openAdd() {
		reset();
		editing = null;
		kind = 'credit';
		name = last4 = limit = '';
		closing = due = null;
		remindHour = '12';
		open = true;
	}

	function openEdit(m: Row) {
		if (m.kind === 'cash') return;
		reset();
		editing = m.id;
		kind = m.kind;
		name = m.name;
		last4 = m.last4 ?? '';
		limit = m.limitCents === null ? '' : String(m.limitCents / 100);
		closing = m.closingDay ? nextOnDay(today, m.closingDay) : null;
		due = m.dueDay ? nextOnDay(today, m.dueDay) : null;
		remindHour = String(Math.floor(m.remindAtMinutes / 60));
		open = true;
	}

	// Same hours as recurring reminders: on the hour, noon by default.
	function hourLabel(h: number): string {
		if (h === 0) return '12 AM (midnight)';
		if (h === 12) return '12 PM (noon)';
		return `${h % 12} ${h < 12 ? 'AM' : 'PM'}`;
	}
	const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }));

	function repeatsText(d: PlainDate): string {
		return `Every month on the ${ordinal(d.day)}${d.day > 28 ? ' (or the month’s last day)' : ''}.`;
	}

	const dateFields = [
		{
			id: 'pm-closing',
			text: 'Statement closing date',
			name: 'closingDay',
			error: 'closingDay',
			get: () => closing,
			set: (d: PlainDate | null) => (closing = d)
		},
		{
			id: 'pm-due',
			text: 'Payment due date',
			name: 'dueDay',
			error: 'dueDay',
			get: () => due,
			set: (d: PlainDate | null) => (due = d)
		}
	] as const;

	const input =
		'w-full rounded-md border-gray-300 bg-white text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
	const fieldLabel = 'text-sm font-medium';
	const optional = 'font-normal text-gray-500';
	const hint = 'text-xs text-gray-500 dark:text-gray-400';
	const errorText = 'text-xs text-red-700 dark:text-red-400';
</script>

<svelte:head>
	<title>Payment methods · Settings · Budget</title>
</svelte:head>

{#snippet row(m: Row)}
	<span class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800">
		<PaymentMethodIcon kind={m.kind} class="size-4 text-gray-600 dark:text-gray-300" />
	</span>
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="truncate text-sm font-medium">{m.name}</span>
		<span class="truncate text-xs text-gray-500 dark:text-gray-400">{subtitle(m)}</span>
	</span>
	<span class="flex shrink-0 flex-col items-end">
		<span class="text-sm tabular-nums">{formatCents(amountOf(m))}</span>
		{#if m.limitCents}
			{@const share = amountOf(m) / m.limitCents}
			<span
				class={[
					'text-xs tabular-nums',
					share > 1
						? 'font-medium text-red-700 dark:text-red-400'
						: share >= UTILIZATION_WARN
							? 'font-medium text-amber-700 dark:text-amber-400'
							: 'text-gray-500 dark:text-gray-400'
				]}
			>
				{Math.round(share * 100)}% of {formatCentsWhole(m.limitCents)}
			</span>
		{:else}
			<span class="text-xs text-gray-500 dark:text-gray-400">{periodOf(m)}</span>
		{/if}
	</span>
{/snippet}

<section aria-labelledby="section-title">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 id="section-title" class="text-lg font-semibold">Payment methods</h2>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Cards and apps you pay with. Pick one when you add an expense to see what went where.
			</p>
		</div>
		<button
			type="button"
			onclick={openAdd}
			class="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
		>
			<Plus class="size-4" aria-hidden="true" />
			Add method
		</button>
	</div>

	<div
		class="mt-3 flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800"
	>
		<Switch.Root
			id="show-credit-cards"
			checked={showCreditCards}
			onCheckedChange={setShowCreditCards}
			class="mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700"
		>
			<Switch.Thumb
				class="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-gray-900"
			/>
		</Switch.Root>
		<label for="show-credit-cards" class="text-sm">
			Show “Credit cards” on the home page
			<span class="block text-xs text-gray-500 dark:text-gray-400">
				Billing cycle, last statement and next payment for each credit card.
			</span>
		</label>
	</div>

	{#if data.methods.every((m) => m.kind === 'cash')}
		<p
			class="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700"
		>
			No cards or apps yet. Add a credit card, debit card or an app like Venmo.
		</p>
	{/if}

	<ul
		class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
	>
		{#each data.methods as m (m.id)}
			<li>
				{#if m.kind === 'cash'}
					<div class="flex w-full items-center gap-3 px-3 py-2.5">
						{@render row(m)}
					</div>
				{:else}
					<button
						type="button"
						onclick={() => openEdit(m)}
						data-no-press
						class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-900"
					>
						{@render row(m)}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
	{#if data.methods.some((m) => m.card?.cycle)}
		<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
			Credit cards with a closing date show the current billing cycle; the rest show this month.
			Only expenses marked “Paid with” count.
		</p>
	{/if}
</section>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-black/40" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<Dialog.Title class="text-base font-semibold">
				{editing ? 'Edit payment method' : 'Add payment method'}
			</Dialog.Title>

			<form
				method="post"
				action="?/save"
				class="mt-4 flex flex-col gap-4"
				novalidate
				use:enhance={({ action, cancel }) => {
					const removing = action.search.includes('remove');
					if (!removing) {
						submitted = true;
						serverErrors = {};
						if ('errors' in parsed) return cancel();
					}
					pending = true;
					formError = '';
					const label = name.trim();
					return async ({ result, update }) => {
						pending = false;
						if (result.type === 'success') {
							open = false;
							if (removing) {
								toast.success(`Removed ${label}.`, {
									description: 'Expenses already paid with it keep showing it.'
								});
							} else {
								const saved = result.data?.saved as { name: string; created: boolean } | undefined;
								toast.success(saved?.created ? `Added ${saved.name}.` : `Saved ${label}.`);
							}
							await update({ reset: false });
						} else if (result.type === 'failure') {
							serverErrors = (result.data?.errors as PaymentMethodErrors) ?? {};
							formError = (result.data?.error as string) ?? '';
						} else if (result.type === 'error') {
							formError = navigator.onLine
								? 'Something went wrong. Please try again.'
								: "You're offline. Saving needs a connection.";
						} else {
							await update();
						}
					};
				}}
			>
				{#if editing}<input type="hidden" name="id" value={editing} />{/if}

				<fieldset
					class="grid grid-cols-3 gap-0.5 rounded-md border border-gray-200 p-0.5 dark:border-gray-700"
				>
					<legend class="sr-only">Type</legend>
					{#each ADDABLE_KINDS as value (value)}
						<label
							class="cursor-pointer rounded px-2 py-1.5 text-center text-sm font-medium text-gray-600 transition hover:text-gray-900 has-checked:bg-gray-900 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-gray-400 dark:text-gray-400 dark:hover:text-gray-100 dark:has-checked:bg-white dark:has-checked:text-gray-900"
						>
							<input type="radio" name="kind" {value} bind:group={kind} class="sr-only" />
							{KIND_TAB[value]}
						</label>
					{/each}
				</fieldset>

				<div class="flex flex-col gap-1">
					<label for="pm-name" class={fieldLabel}>Name</label>
					<input
						id="pm-name"
						name="name"
						bind:value={name}
						maxlength={PAYMENT_METHOD_NAME_MAX}
						autocomplete="off"
						placeholder={PLACEHOLDER[kind]}
						class={input}
						aria-invalid={errors.name ? true : undefined}
						aria-describedby={errors.name ? 'pm-name-error' : undefined}
					/>
					{#if errors.name}
						<p id="pm-name-error" class={errorText}>{errors.name}</p>
					{:else if kind === 'p2p'}
						<p class={hint}>Venmo, Cash App, Zelle, PayPal, Apple Cash…</p>
					{/if}
				</div>

				{#if kind !== 'p2p'}
					<div class={kind === 'credit' ? 'grid gap-4 sm:grid-cols-2 sm:gap-3' : 'flex flex-col'}>
						<div class="flex flex-col gap-1">
							<label for="pm-last4" class={fieldLabel}>
								Last 4 digits <span class={optional}>(optional)</span>
							</label>
							<input
								id="pm-last4"
								name="last4"
								bind:value={last4}
								inputmode="numeric"
								maxlength="4"
								autocomplete="off"
								placeholder="1234"
								class="{input} tabular-nums"
								aria-invalid={errors.last4 ? true : undefined}
								aria-describedby="pm-last4-hint"
							/>
							<p id="pm-last4-hint" class={errors.last4 ? errorText : hint}>
								{errors.last4 ?? 'Only to tell cards apart.'}
							</p>
						</div>

						{#if kind === 'credit'}
							<div class="flex flex-col gap-1">
								<label for="pm-limit" class={fieldLabel}>
									Credit limit <span class={optional}>(optional)</span>
								</label>
								<div class="relative">
									<span
										class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-500"
										aria-hidden="true">$</span
									>
									<input
										id="pm-limit"
										name="limit"
										bind:value={limit}
										inputmode="decimal"
										autocomplete="off"
										placeholder="5000"
										class="{input} pl-7 tabular-nums"
										aria-invalid={errors.limit ? true : undefined}
										aria-describedby={errors.limit ? 'pm-limit-error' : undefined}
									/>
								</div>
								{#if errors.limit}<p id="pm-limit-error" class={errorText}>{errors.limit}</p>{/if}
							</div>
						{/if}
					</div>
				{/if}

				{#if kind === 'credit'}
					<div class="flex flex-col gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
						<p class={hint}>
							Pick the next one of each from your statement. They repeat every month; leave them
							empty if you don’t know them.
						</p>

						{#each dateFields as field (field.id)}
							{@const value = field.get()}
							<div class="flex flex-col gap-1">
								<div class="flex items-baseline justify-between gap-2">
									<span id="{field.id}-label" class={fieldLabel}>
										{field.text} <span class={optional}>(optional)</span>
									</span>
									{#if value}
										<button
											type="button"
											class="text-xs text-gray-500 underline hover:text-gray-900 dark:hover:text-gray-100"
											onclick={() => field.set(null)}
										>
											Clear<span class="sr-only"> {field.text.toLowerCase()}</span>
										</button>
									{/if}
								</div>
								<input type="hidden" name={field.name} value={value?.day ?? ''} />
								<DatePicker
									bind:value={field.get, field.set}
									labelledby="{field.id}-label"
									min={dateMin}
									max={dateMax}
									invalid={Boolean(errors[field.error])}
								/>
								{#if errors[field.error]}
									<p class={errorText}>{errors[field.error]}</p>
								{:else if value}
									<p class={hint}>{repeatsText(value)}</p>
								{/if}
							</div>
						{/each}

						{#if due}
							<div class="flex flex-col gap-1">
								<span id="pm-remind-label" class={fieldLabel}>Remind me at</span>
								<Select.Root type="single" name="remindHour" bind:value={remindHour} items={HOURS}>
									<Select.Trigger
										data-no-press
										class="{input} flex items-center gap-2 border px-3 py-2 text-left"
										aria-labelledby="pm-remind-label"
									>
										<Bell class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
										<span>{hourLabel(Number(remindHour))}</span>
										<ChevronDown class="ml-auto size-4 shrink-0 text-gray-500" aria-hidden="true" />
									</Select.Trigger>
									<Select.Portal>
										<Select.Content
											sideOffset={4}
											class="z-60 max-h-72 w-(--bits-select-anchor-width) min-w-48 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg outline-none dark:border-gray-700 dark:bg-gray-900"
										>
											<Select.Viewport>
												{#each HOURS as h (h.value)}
													<Select.Item
														value={h.value}
														label={h.label}
														class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 data-highlighted:bg-gray-100 dark:data-highlighted:bg-gray-800"
													>
														{#snippet children({ selected })}
															<span>{h.label}</span>
															{#if selected}<Check class="ml-auto size-4" aria-hidden="true" />{/if}
														{/snippet}
													</Select.Item>
												{/each}
											</Select.Viewport>
										</Select.Content>
									</Select.Portal>
								</Select.Root>
								<p class={hint}>
									The day before and the day it’s due, on devices with notifications on.
								</p>
							</div>
						{/if}
					</div>
				{/if}

				{#if formError}
					<p class="text-sm text-red-700 dark:text-red-400" role="alert">{formError}</p>
				{/if}

				{#if confirmRemove}
					<div
						class="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
					>
						<p>
							Remove <strong>{name.trim() || 'this method'}</strong>? Expenses already paid with it
							keep showing it, but you won’t be able to pick it any more.
						</p>
						<div class="flex justify-end gap-2">
							<button
								type="button"
								onclick={() => (confirmRemove = false)}
								class="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
							>
								Keep
							</button>
							<button
								formaction="?/remove"
								disabled={pending}
								class="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
							>
								{pending ? 'Removing…' : 'Remove'}
							</button>
						</div>
					</div>
				{:else}
					<div class="flex items-center gap-2">
						{#if editing}
							<button
								type="button"
								onclick={() => (confirmRemove = true)}
								class="mr-auto rounded-md px-2 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
							>
								Remove
							</button>
						{/if}
						<Dialog.Close
							type="button"
							class={[
								'rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
								!editing && 'ml-auto'
							]}
						>
							Cancel
						</Dialog.Close>
						<button
							type="submit"
							disabled={pending}
							class="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
						>
							{#if !pending}<Check class="size-4" aria-hidden="true" />{/if}
							{pending ? 'Saving…' : editing ? 'Save' : 'Add'}
						</button>
					</div>
				{/if}
			</form>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
