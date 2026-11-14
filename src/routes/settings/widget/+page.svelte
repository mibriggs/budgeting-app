<!--
	Settings → Widget. Tokens for the Home Screen widget (Scriptable): make one, copy it once,
	revoke ones you don't use. A token can only read this month's numbers from /api/widget.
	Below: setup steps and the two scripts (net cash flow, top spending) to copy into Scriptable;
	right after making a token, the copied script already has it filled in.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import TrendingUp from '@lucide/svelte/icons/trending-up';
	import ChartBar from '@lucide/svelte/icons/chart-bar';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { TOKEN_NAME_MAX } from '#lib/token-limits.ts';
	import { widgetScript, WIDGETS, type WidgetKind } from '#lib/widget-scripts/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let creating = $state(false);
	let confirming = $state<string | null>(null);
	let copied = $state(false);
	let copiedScript = $state<WidgetKind | null>(null);

	// The token just made, if any: copied scripts include it so there's nothing to paste in.
	const newToken = $derived(form && 'token' in form ? form.token : undefined);
	const script = (kind: WidgetKind) => widgetScript(kind, data.origin, newToken);

	async function copyScript(kind: WidgetKind) {
		try {
			await navigator.clipboard.writeText(script(kind));
			copiedScript = kind;
			setTimeout(() => (copiedScript = null), 2000);
		} catch {
			toast.error('Couldn’t copy. Open “Show the code” and copy it yourself.');
		}
	}
	const SCRIPTS: { kind: WidgetKind; icon: typeof Plus; about: string }[] = [
		{
			kind: 'net',
			icon: TrendingUp,
			about: 'This month’s income minus spending, with an up or down arrow.'
		},
		{
			kind: 'top',
			icon: ChartBar,
			about: 'Your 3 biggest categories this month and their share of spending.'
		}
	];

	async function copyToken(token: string) {
		try {
			await navigator.clipboard.writeText(token);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			toast.error('Couldn’t copy. Select the token and copy it yourself.');
		}
	}

	const dateTime = (date: Date) =>
		date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	function lastUsed(date: Date | null) {
		if (!date) return 'Never used';
		const minutes = (Date.now() - date.getTime()) / 60_000;
		if (minutes < 90) return 'Used in the last hour';
		if (minutes < 60 * 24) return `Used ${Math.round(minutes / 60)} hours ago`;
		return `Used ${dateTime(date)}`;
	}

	const button =
		'flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800';
</script>

<svelte:head>
	<title>Widget · Settings · Budget</title>
</svelte:head>

<section aria-labelledby="section-title" class="flex flex-col gap-4">
	<div>
		<h2 id="section-title" class="text-lg font-semibold">Widget</h2>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Show this month’s numbers on your iPhone Home Screen with
			<span class="font-medium text-gray-700 dark:text-gray-300">Scriptable</span>, a free app. The
			widget uses a token to read your numbers. Tokens can only read; they can’t change anything.
		</p>
	</div>

	{#if form && 'token' in form && form.token}
		<!-- Shown once: the token isn't stored, so it can't be shown again after this. -->
		<div
			class="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
			role="status"
		>
			<p class="text-sm font-medium">Copy your token now. It won’t be shown again.</p>
			<div class="flex items-center gap-2">
				<code
					class="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1.5 font-mono text-xs dark:bg-gray-900"
				>
					{form.token}
				</code>
				<button type="button" class={button} onclick={() => copyToken(form.token)}>
					{#if copied}
						<Check class="size-4" aria-hidden="true" /> Copied
					{:else}
						<Copy class="size-4" aria-hidden="true" /> Copy
					{/if}
				</button>
			</div>
			<p class="text-xs text-gray-600 dark:text-gray-400">
				Paste it into the widget script where it says <code>PASTE_TOKEN_HERE</code>. Anyone with it
				can read this month’s totals, so don’t share it.
			</p>
		</div>
	{/if}

	<!-- Make a token -->
	<form
		method="POST"
		action="?/create"
		class="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
		use:enhance={() => {
			creating = true;
			return async ({ update }) => {
				await update({ reset: false });
				creating = false;
			};
		}}
	>
		<label for="token-name" class="text-sm font-medium">New token</label>
		<div class="flex flex-wrap gap-2">
			<input
				id="token-name"
				name="name"
				value="iPhone widget"
				maxlength={TOKEN_NAME_MAX}
				required
				aria-invalid={form && 'error' in form && !('revoked' in form) ? true : undefined}
				aria-describedby="token-name-help"
				class="min-w-0 flex-1 rounded-md border-gray-300 text-sm dark:border-gray-700 dark:bg-gray-900"
			/>
			<button type="submit" class={button} disabled={creating}>
				<Plus class="size-4" aria-hidden="true" />
				Make token
			</button>
		</div>
		<p id="token-name-help" class="text-xs text-gray-500 dark:text-gray-400">
			{#if form && 'error' in form && form.error}
				<span class="text-red-600 dark:text-red-400">{form.error}</span>
			{:else}
				A name to tell it apart, like the phone it’s on.
			{/if}
		</p>
	</form>

	<!-- Tokens -->
	<div>
		<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">
			Tokens · {data.tokens.length}
		</h3>
		{#if data.tokens.length === 0}
			<p
				class="mt-2 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700"
			>
				None yet.
			</p>
		{:else}
			<ul
				class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
			>
				{#each data.tokens as token (token.id)}
					<li class="flex items-center gap-3 px-3 py-2.5">
						<KeyRound class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm">
								{token.name}
								<span class="font-mono text-xs text-gray-500">…{token.hint}</span>
							</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								Made {dateTime(token.createdAt)} · {lastUsed(token.lastUsedAt)}
							</span>
						</div>
						{#if confirming === token.id}
							<form
								method="POST"
								action="?/revoke"
								class="flex items-center gap-1"
								use:enhance={() =>
									async ({ update, result }) => {
										await update();
										confirming = null;
										if (result.type === 'success') toast.success('Token revoked.');
									}}
							>
								<input type="hidden" name="id" value={token.id} />
								<button
									type="submit"
									class="rounded-md bg-red-600 px-2 py-1 text-sm text-white hover:bg-red-700"
									aria-label="Revoke {token.name} now"
								>
									Revoke
								</button>
								<button
									type="button"
									class="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
									onclick={() => (confirming = null)}
								>
									Cancel
								</button>
							</form>
						{:else}
							<button
								type="button"
								onclick={() => (confirming = token.id)}
								class="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-red-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-red-400"
								aria-label="Revoke {token.name}"
							>
								Revoke
							</button>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Revoking stops that widget right away; it shows “Widget needs a new token”.
			</p>
		{/if}
	</div>

	<!-- Scripts -->
	<div class="flex flex-col gap-3">
		<h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Set up the widget</h3>
		<ol
			class="flex list-decimal flex-col gap-1.5 rounded-lg border border-gray-200 p-4 pl-8 text-sm dark:border-gray-800"
		>
			<li>Install <span class="font-medium">Scriptable</span> from the App Store (free).</li>
			<li>Make a token above.</li>
			<li>
				Copy a script below. In Scriptable, tap <span class="font-medium">+</span> and paste it.
				{#if newToken}
					Your new token is already in it.
				{:else}
					Replace <code class="text-xs">PASTE_TOKEN_HERE</code> with your token.
				{/if}
				Tap the title at the top to name it, like “{WIDGETS.net.name}”.
			</li>
			<li>Tap ▶︎ to try it: Scriptable shows a preview.</li>
			<li>
				On your Home Screen, add a <span class="font-medium">Scriptable</span> widget (small or
				medium). Touch and hold it, tap <span class="font-medium">Edit Widget</span>, and pick the
				script.
			</li>
		</ol>

		<div class="grid gap-3 sm:grid-cols-2">
			{#each SCRIPTS as s (s.kind)}
				<div class="flex flex-col gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
					<div class="flex items-center gap-2">
						<s.icon class="size-4 text-gray-500" aria-hidden="true" />
						<span class="font-medium">{WIDGETS[s.kind].title}</span>
					</div>
					<p class="text-sm text-gray-500 dark:text-gray-400">{s.about}</p>
					<button type="button" class="{button} self-start" onclick={() => copyScript(s.kind)}>
						{#if copiedScript === s.kind}
							<Check class="size-4" aria-hidden="true" /> Copied
						{:else}
							<Copy class="size-4" aria-hidden="true" />
							{newToken ? 'Copy script with token' : 'Copy script'}
						{/if}
					</button>
					<details class="text-sm">
						<summary class="cursor-pointer text-gray-500 dark:text-gray-400">
							Show the code
						</summary>
						<pre
							class="mt-2 max-h-72 overflow-auto rounded-md bg-gray-50 p-2 text-[11px] leading-snug dark:bg-gray-900">{widgetScript(
								s.kind,
								data.origin
							)}</pre>
					</details>
				</div>
			{/each}
		</div>
		<p class="text-xs text-gray-500 dark:text-gray-400">
			Without a connection the widget keeps showing the last numbers it got, dimmed, with when
			they’re from. iOS decides how often widgets refresh, so it can lag a few minutes behind.
		</p>
	</div>
</section>
