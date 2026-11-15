<!--
	Mock: the home page "Credit cards" card always shows (unless hidden), and can be hidden from
	the card itself or from Settings → Payment methods. Sample data; nothing is saved.

	- No credit cards yet: a short prompt and an "Add a credit card" link to Settings.
	- With cards: the card as built (shortened here), with the dropdown.
	- The × on the card hides it. It leaves with the animation picked at the top, and a toast
	  offers Undo and says where to turn it back on.
	- Settings → Payment methods has a "Show on the home page" switch for the same thing.
	Reduce Motion: no animation, it just goes.
-->
<script lang="ts">
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import X from '@lucide/svelte/icons/x';
	import { Switch } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';
	import { blur, fade, slide } from 'svelte/transition';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import type { PaymentMethodKind } from '#lib/payment-methods.ts';

	type Data = 'none' | 'cards';
	type Motion = 'fade' | 'blur' | 'blur-collapse';
	let data = $state<Data>('none');
	let motion = $state<Motion>('blur-collapse');
	let visible = $state(true);

	const listed = $derived<[PaymentMethodKind, string][]>(
		data === 'cards'
			? [
					['credit', 'Chase Sapphire'],
					['credit', 'Amex Gold'],
					['cash', 'Cash']
				]
			: [['cash', 'Cash']]
	);

	const DATA: [Data, string][] = [
		['none', 'No credit cards'],
		['cards', 'Two cards']
	];
	const MOTIONS: [Motion, string][] = [
		['fade', 'Fade'],
		['blur', 'Blur'],
		['blur-collapse', 'Blur, then close the gap']
	];

	const still = $derived(prefersReducedMotion.current);
	// The card's own animation. "Close the gap" also slides the space shut after it's gone, so
	// the cards below move up smoothly instead of jumping.
	function cardOut(node: Element) {
		if (still) return { duration: 0 };
		return motion === 'fade'
			? fade(node, { duration: 250 })
			: blur(node, { duration: 300, amount: 8, easing: cubicOut });
	}
	function gap(node: Element) {
		if (still || motion !== 'blur-collapse') return { duration: 0 };
		return slide(node, { duration: 250, delay: 250, easing: cubicOut });
	}

	function hide() {
		visible = false;
		toast('Credit cards hidden from home.', {
			description: 'Turn it back on in Settings → Payment methods.',
			action: { label: 'Undo', onClick: () => (visible = true) }
		});
	}

	const toggle =
		'rounded-md border border-gray-300 px-2.5 py-1 text-xs aria-pressed:bg-gray-900 aria-pressed:text-white dark:border-gray-700 dark:aria-pressed:bg-white dark:aria-pressed:text-gray-900';
	const switchRoot =
		'inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700';
	const switchThumb =
		'block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-gray-900';
	const label = 'text-xs text-gray-500 dark:text-gray-400';
</script>

<svelte:head>
	<title>Home card hiding mock</title>
</svelte:head>

<!-- Mock controls (not part of the page) -->
<div
	class="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-dashed border-gray-300 bg-gray-50/90 px-4 py-2 text-xs backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"
>
	<span class="font-medium text-gray-500">Data:</span>
	{#each DATA as [value, text] (value)}
		<button
			type="button"
			class={toggle}
			aria-pressed={data === value}
			onclick={() => (data = value)}
		>
			{text}
		</button>
	{/each}
	<span class="ml-2 font-medium text-gray-500">Animation:</span>
	{#each MOTIONS as [value, text] (value)}
		<button
			type="button"
			class={toggle}
			aria-pressed={motion === value}
			onclick={() => (motion = value)}
		>
			{text}
		</button>
	{/each}
</div>

<!-- Stand-in for the other home cards, to see what moves when the card goes. -->
{#snippet placeholder(title: string)}
	<section
		class="flex flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
		aria-hidden="true"
	>
		<h2 class="text-sm font-medium">{title}</h2>
		<div class="h-2.5 w-4/5 rounded bg-gray-100 dark:bg-gray-800"></div>
		<div class="h-2.5 w-3/5 rounded bg-gray-100 dark:bg-gray-800"></div>
	</section>
{/snippet}

<main class="mx-auto grid max-w-5xl gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
	<!-- Home page -->
	<div class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-gray-500">Home page</h2>
		{@render placeholder('Budgets')}

		{#if visible}
			<div transition:gap>
				<section
					transition:cardOut
					class="flex min-w-0 flex-col gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
				>
					<header class="flex items-start justify-between gap-2">
						<h2 class="text-sm font-medium">Credit cards</h2>
						<div class="flex items-center gap-1">
							{#if data === 'cards'}
								<span
									class="flex items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium dark:border-gray-700"
								>
									<CreditCard class="size-3.5 text-gray-500" aria-hidden="true" />
									Chase Sapphire
									<ChevronDown class="size-3.5 text-gray-500" aria-hidden="true" />
								</span>
							{/if}
							<button
								type="button"
								onclick={hide}
								class="-mr-1 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
								aria-label="Hide Credit cards from home"
								title="Hide from home"
							>
								<X class="size-4" aria-hidden="true" />
							</button>
						</div>
					</header>

					{#if data === 'none'}
						<div class="flex items-start gap-3">
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
							>
								<CreditCard class="size-4 text-gray-600 dark:text-gray-300" aria-hidden="true" />
							</span>
							<div class="flex flex-col items-start gap-2">
								<p class="text-sm text-gray-600 dark:text-gray-300">
									Add a credit card to track billing cycles, statements and due dates.
								</p>
								<span
									class="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
								>
									Add a credit card
								</span>
							</div>
						</div>
					{:else}
						<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
							<div class="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
								<span class={label}>Since Nov 9</span>
								<span class="text-xl font-semibold tabular-nums">$75.00</span>
								<div class="h-1.5 overflow-hidden rounded-full bg-blue-500/20">
									<div class="h-full w-[2%] rounded-full bg-blue-500"></div>
								</div>
								<span class={label}>2% of $5,000 limit · closes Dec 8</span>
							</div>
							<div class="flex flex-col gap-1.5">
								<span class={label}>Last statement</span>
								<span class="text-xl font-semibold tabular-nums">$500.00</span>
								<span class={label}>Oct 9 – Nov 8</span>
							</div>
							<div class="flex flex-col gap-1.5">
								<span class={label}>Next payment</span>
								<span class="text-xl font-semibold tabular-nums">Dec 3</span>
								<span class={label}>$500.00 · in 18 days</span>
							</div>
						</div>
					{/if}
				</section>
			</div>
		{/if}

		{@render placeholder('On pace?')}
		{@render placeholder('Income vs expenses')}
	</div>

	<!-- Settings → Payment methods (top of the page) -->
	<div class="flex flex-col gap-4">
		<h2 class="text-sm font-medium text-gray-500">Settings → Payment methods</h2>
		<section class="flex flex-col gap-3">
			<div>
				<h3 class="text-lg font-semibold">Payment methods</h3>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Cards and apps you pay with. Pick one when you add an expense to see what went where.
				</p>
			</div>

			<div
				class="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800"
			>
				<Switch.Root id="show-cards" bind:checked={visible} class="mt-0.5 {switchRoot}">
					<Switch.Thumb class={switchThumb} />
				</Switch.Root>
				<label for="show-cards" class="text-sm">
					Show “Credit cards” on the home page
					<span class="block text-xs text-gray-500 dark:text-gray-400">
						Billing cycle, last statement and next payment for each credit card.
					</span>
				</label>
			</div>

			<ul
				class="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
				aria-hidden="true"
			>
				{#each listed as [kind, name] (name)}
					<li class="flex items-center gap-3 px-3 py-2.5">
						<span
							class="grid size-8 shrink-0 place-items-center rounded-full bg-gray-100 dark:bg-gray-800"
						>
							<PaymentMethodIcon {kind} class="size-4 text-gray-600 dark:text-gray-300" />
						</span>
						<span class="text-sm font-medium">{name}</span>
					</li>
				{/each}
			</ul>
		</section>
	</div>
</main>
