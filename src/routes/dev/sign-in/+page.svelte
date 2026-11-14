<!--
	Mock: the sign-in page with "Continue with Google" above "Continue with GitHub". The Google
	button follows Google's branding rules (white or dark button, the unaltered four-colour G, the
	words "Sign in with Google" or "Continue with Google"). Toggles at the top try the wording,
	order, an error message and a moving background; the page below is drawn as the real one
	would be.

	Backgrounds (all decorative, hidden from screen readers, still for Reduce Motion):
	- Glow: three soft colour blobs drifting slowly.
	- Icons: columns of the app's category icons scrolling up and down, clear in the middle.
	- Preview: small made-up app cards (spending ring, bars, payments) floating around the edges.
-->
<script lang="ts">
	import { CATEGORY_ICONS } from '#lib/category-icons.ts';
	import GithubLogo from '#lib/components/GithubLogo.svelte';
	import GoogleLogo from '#lib/components/GoogleLogo.svelte';

	let verb = $state<'Continue' | 'Sign in'>('Sign in');
	let googleFirst = $state(false);
	let showError = $state(false);
	let showTagline = $state(true);
	type Background = 'none' | 'glow' | 'icons' | 'preview';
	let background = $state<Background>('glow');
	const BACKGROUNDS: [Background, string][] = [
		['none', 'Plain'],
		['glow', 'Glow'],
		['icons', 'Icons'],
		['preview', 'Preview']
	];

	const buttons = $derived(googleFirst ? ['google', 'github'] : ['github', 'google']);

	// Icons background: 7 columns, each a shuffled slice of the category icons, drawn twice so
	// the loop is seamless (the column moves by half its height, then starts over).
	const allIcons = Object.values(CATEGORY_ICONS).map((i) => i.icon);
	const columns = Array.from({ length: 7 }, (_, c) =>
		Array.from({ length: 12 }, (_, r) => allIcons[(c * 11 + r * 7) % allIcons.length])
	);

	const toggle =
		'rounded-md border border-gray-300 px-2.5 py-1 text-xs aria-pressed:bg-gray-900 aria-pressed:text-white dark:border-gray-700 dark:aria-pressed:bg-white dark:aria-pressed:text-gray-900';
</script>

<svelte:head>
	<title>Sign in mock</title>
</svelte:head>

<!-- Mock controls (not part of the page) -->
<div
	class="fixed inset-x-0 top-0 z-20 flex flex-wrap items-center gap-2 border-b border-dashed border-gray-300 bg-gray-50/90 px-4 py-2 text-xs backdrop-blur dark:border-gray-700 dark:bg-gray-900/90"
>
	<span class="font-medium text-gray-500">Mock:</span>
	<button
		type="button"
		class={toggle}
		aria-pressed={verb === 'Continue'}
		onclick={() => (verb = verb === 'Continue' ? 'Sign in' : 'Continue')}
	>
		“{verb} with”
	</button>
	<button
		type="button"
		class={toggle}
		aria-pressed={googleFirst}
		onclick={() => (googleFirst = !googleFirst)}
	>
		{googleFirst ? 'Google first' : 'GitHub first'}
	</button>
	<button
		type="button"
		class={toggle}
		aria-pressed={showTagline}
		onclick={() => (showTagline = !showTagline)}
	>
		Tagline
	</button>
	<button
		type="button"
		class={toggle}
		aria-pressed={showError}
		onclick={() => (showError = !showError)}
	>
		Error
	</button>
	<span class="ml-2 font-medium text-gray-500">Background:</span>
	{#each BACKGROUNDS as [key, label] (key)}
		<button
			type="button"
			class={toggle}
			aria-pressed={background === key}
			onclick={() => (background = key)}
		>
			{label}
		</button>
	{/each}
</div>

<!-- Moving background, behind everything. -->
<div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
	{#if background === 'glow'}
		<div class="blob blob-a"></div>
		<div class="blob blob-b"></div>
		<div class="blob blob-c"></div>
	{:else if background === 'icons'}
		<div class="icons-mask flex h-full justify-around">
			{#each columns as column, c (c)}
				<div
					class="icon-column"
					style:--duration="{48 + ((c * 13) % 30)}s"
					class:reverse={c % 2 === 1}
				>
					{#each [0, 1] as copy (copy)}
						{#each column as Icon, r (`${copy}-${r}`)}
							<span
								class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-600"
							>
								<Icon class="size-5" />
							</span>
						{/each}
					{/each}
				</div>
			{/each}
		</div>
	{:else if background === 'preview'}
		<!-- Made-up numbers: decoration only. -->
		<div class="float card top-[12%] left-[4%] w-44" style:--delay="0s">
			<div class="text-[10px] text-gray-500">Spent in Nov</div>
			<div class="text-lg font-semibold tabular-nums">$2,418</div>
			<div class="mt-2 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
				<div class="h-full w-[62%] rounded-full bg-(--chart-1)"></div>
			</div>
			<div class="mt-1 text-[10px] text-gray-500">62% of budget</div>
		</div>
		<div class="float card top-[8%] right-[5%] w-36" style:--delay="-2s">
			<div
				class="mx-auto size-20 rounded-full"
				style="background: conic-gradient(var(--chart-1) 0 45%, var(--chart-2) 45% 70%, var(--chart-3) 70% 85%, var(--chart-4) 85% 100%); mask: radial-gradient(circle, transparent 52%, #000 53%);"
			></div>
			<div class="mt-2 text-center text-[10px] text-gray-500">By category</div>
		</div>
		<div class="float card bottom-[14%] left-[6%] w-48" style:--delay="-4s">
			{#each [['Groceries', '$84.20'], ['Netflix', '$17.99'], ['Coffee', '$5.40']] as [name, amount] (name)}
				<div class="flex justify-between py-1 text-xs">
					<span>{name}</span><span class="tabular-nums">{amount}</span>
				</div>
			{/each}
		</div>
		<div class="float card right-[4%] bottom-[10%] w-44" style:--delay="-1s">
			<div class="flex h-16 items-end gap-1.5">
				{#each [40, 65, 50, 80, 55, 70] as h, i (i)}
					<div class="flex-1 rounded-sm bg-(--chart-3)" style:height="{h}%"></div>
				{/each}
			</div>
			<div class="mt-1 text-[10px] text-gray-500">Last 6 months</div>
		</div>
		<div class="float card top-[46%] -right-6 hidden w-40 sm:block" style:--delay="-3s">
			<div class="text-[10px] text-gray-500">Next recurring</div>
			<div class="text-sm font-medium">Rent · Dec 1</div>
		</div>
		<div class="float card top-[42%] -left-4 hidden w-36 sm:block" style:--delay="-5s">
			<div class="text-[10px] text-gray-500">Net this month</div>
			<div class="text-sm font-semibold text-green-600 tabular-nums">↑ $640</div>
		</div>
	{/if}
</div>

<main class="relative mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center p-6">
	<!-- With a background, the content sits on a frosted panel so it stays readable. -->
	<div
		class={[
			'flex w-full flex-col items-center gap-6',
			background !== 'none' &&
				'rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/70'
		]}
	>
		<div class="flex flex-col items-center gap-2 text-center">
			<img src="/icons/icon-192.png" alt="" class="size-14 rounded-2xl shadow-sm" />
			<h1 class="text-3xl font-semibold">Sign in</h1>
			{#if showTagline}
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Track spending, budgets and recurring bills.
				</p>
			{/if}
		</div>

		<div class="flex w-full flex-col gap-3">
			{#each buttons as provider (provider)}
				{#if provider === 'google'}
					<!-- Google's light/dark button: white with a grey border, or near-black in dark mode. -->
					<button
						type="button"
						class="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-[#747775] bg-white px-4 text-sm font-medium text-[#1f1f1f] transition hover:bg-gray-50 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]"
					>
						<GoogleLogo class="size-5" />
						{verb} with Google
					</button>
				{:else}
					<button
						type="button"
						class="flex h-11 w-full items-center justify-center gap-3 rounded-md bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						<GithubLogo />
						{verb} with GitHub
					</button>
				{/if}
			{/each}
		</div>

		{#if showError}
			<p class="text-sm text-red-600" role="alert">Google sign-in failed. Please try again.</p>
		{/if}

		<p class="text-center text-xs text-gray-500 dark:text-gray-400">
			Use the same one each time. If your Google and GitHub accounts share an email, either one
			opens the same account.
		</p>
	</div>
</main>

<style>
	/* Glow */
	.blob {
		position: absolute;
		width: 70vmax;
		height: 70vmax;
		border-radius: 9999px;
		filter: blur(90px);
		opacity: 0.35;
		animation: drift 28s ease-in-out infinite alternate;
	}
	:global(.dark) .blob {
		opacity: 0.22;
	}
	.blob-a {
		background: #34d399;
		top: -30vmax;
		left: -20vmax;
	}
	.blob-b {
		background: #818cf8;
		bottom: -35vmax;
		right: -25vmax;
		animation-duration: 34s;
		animation-delay: -8s;
	}
	.blob-c {
		background: #fbbf24;
		top: 30%;
		left: 40%;
		width: 45vmax;
		height: 45vmax;
		opacity: 0.2;
		animation-duration: 40s;
		animation-delay: -15s;
	}
	@keyframes drift {
		from {
			transform: translate(0, 0) scale(1);
		}
		50% {
			transform: translate(8vmax, 6vmax) scale(1.1);
		}
		to {
			transform: translate(-6vmax, 10vmax) scale(0.95);
		}
	}

	/* Icons */
	.icons-mask {
		/* Fades out toward the middle, where the sign-in panel sits. */
		mask-image: radial-gradient(ellipse 45% 40% at 50% 50%, transparent 30%, #000 85%);
	}
	.icon-column {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		animation: scroll-up var(--duration) linear infinite;
	}
	.icon-column.reverse {
		animation-direction: reverse;
	}
	@keyframes scroll-up {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(-50%);
		}
	}

	/* Preview */
	.card {
		position: absolute;
		border-radius: 1rem;
		border: 1px solid rgb(0 0 0 / 0.06);
		background: rgb(255 255 255 / 0.9);
		padding: 0.75rem;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.08);
		opacity: 0.85;
	}
	:global(.dark) .card {
		border-color: rgb(255 255 255 / 0.08);
		background: rgb(17 24 39 / 0.9);
		opacity: 0.7;
	}
	.float {
		animation: float 7s ease-in-out infinite alternate;
		animation-delay: var(--delay);
	}
	@keyframes float {
		from {
			transform: translateY(-8px) rotate(-1.5deg);
		}
		to {
			transform: translateY(10px) rotate(1.5deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.blob,
		.icon-column,
		.float {
			animation: none;
		}
	}
</style>
