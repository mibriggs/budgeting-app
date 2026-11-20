<!--
	Sign in. GitHub first, then Google (Google's button follows its branding rules: white with a
	grey border, near-black in dark mode, the unaltered four-colour G). Behind it, a slow "glow"
	of three soft colour blobs, decorative only and still for Reduce Motion; the content sits on
	a frosted panel so it stays readable.

	The Google button shows only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
-->
<script lang="ts">
	import GithubLogo from '#lib/components/GithubLogo.svelte';
	import GoogleLogo from '#lib/components/GoogleLogo.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const message = $derived(form?.message ?? data.callbackError);

	const button =
		'flex h-11 w-full items-center justify-center gap-3 rounded-md px-4 text-sm font-medium transition';
</script>

<svelte:head>
	<title>Sign in · CentJar</title>
</svelte:head>

<!--
	The glow layer is `absolute` inside this wrapper, not `fixed`: Safari on iOS tints the status bar
	with the background colour of a fixed element touching the top of the screen, which turned it
	solid green from the first blob.
-->
<div class="relative min-h-dvh overflow-hidden">
	<div class="pointer-events-none absolute inset-0" aria-hidden="true">
		<div class="blob blob-a"></div>
		<div class="blob blob-b"></div>
		<div class="blob blob-c"></div>
	</div>

	<main class="relative mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center p-6">
		<div
			class="flex w-full flex-col items-center gap-6 rounded-3xl border border-white/60 bg-white/70 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/70"
		>
			<div class="flex flex-col items-center gap-2 text-center">
				<img src="/icons/icon-192.png" alt="" class="size-14 rounded-2xl shadow-sm" />
				<h1 class="text-3xl font-semibold">Sign in</h1>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Track spending, budgets and recurring bills.
				</p>
			</div>

			<div class="flex w-full flex-col gap-3">
				<!-- No use:enhance: the actions redirect to GitHub or Google, which needs a full page navigation. -->
				<form method="post" action="?/signInWithGitHub">
					<button
						class="{button} bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
					>
						<GithubLogo />
						Sign in with GitHub
					</button>
				</form>

				{#if data.google}
					<form method="post" action="?/signInWithGoogle">
						<button
							class="{button} border border-[#747775] bg-white text-[#1f1f1f] hover:bg-gray-50 dark:border-[#8e918f] dark:bg-[#131314] dark:text-[#e3e3e3] dark:hover:bg-[#1f1f20]"
						>
							<GoogleLogo class="size-5" />
							Sign in with Google
						</button>
					</form>
				{/if}
			</div>

			{#if message}
				<p class="text-center text-sm text-red-600" role="alert">{message}</p>
			{/if}
		</div>
	</main>
</div>

<style>
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
	@media (prefers-reduced-motion: reduce) {
		.blob {
			animation: none;
		}
	}
</style>
