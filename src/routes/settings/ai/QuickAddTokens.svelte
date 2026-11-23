<!--
	Settings → AI, "Quick add from other apps": make, copy (once) and revoke the tokens automations
	use to send alerts or notes to the inbox with POST /api/quick-add, plus an example request and
	the limits. A Quick add token can only add to the inbox (see #lib/server/api-token.ts).
	Same patterns as the widget tokens on Settings → Widget.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { TOKEN_NAME_MAX } from '#lib/token-limits.ts';

	type Token = {
		id: string;
		name: string;
		hint: string;
		createdAt: Date;
		lastUsedAt: Date | null;
	};
	type Props = {
		tokens: Token[];
		origin: string;
		/** The page's form result: `token` right after making one, `error` when it failed. */
		form: { token?: string; error?: string; revoked?: boolean } | null | undefined;
		/** Claude is on for this account (and the server can use it). */
		claudeOn: boolean;
		readingsPerDay: number;
		limits: { perSecond: number; perMinute: number; perRequest: number; inbox: number };
	};
	let { tokens, origin, form, claudeOn, readingsPerDay, limits }: Props = $props();

	let creating = $state(false);
	let confirming = $state<string | null>(null);
	let copied = $state<'token' | 'example' | null>(null);

	const newToken = $derived(form?.token);
	const example = $derived(`curl -X POST ${origin}/api/quick-add \\
  -H "Authorization: Bearer ${newToken ?? 'YOUR_TOKEN'}" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Chase: You made a $12.50 transaction with STARBUCKS on Nov 22"}'`);
	const response = `{
  "status": "reading",
  "items": [{ "id": "…" }],
  "message": "Saved 1 item to your inbox. You’ll get a notification when it’s read."
}`;

	async function copy(text: string, what: 'token' | 'example') {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
			setTimeout(() => (copied = null), 2000);
		} catch {
			toast.error('Couldn’t copy. Select it and copy it yourself.');
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
	const muted = 'text-xs text-gray-500 dark:text-gray-400';
	const perTime = (n: number, unit: string) =>
		n === 1 ? `One request a ${unit}` : `${n} a ${unit}`;
</script>

<div
	class="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-6 dark:border-gray-800"
	aria-labelledby="tokens-title"
	role="group"
>
	<div>
		<h3 id="tokens-title" class="text-base font-semibold">Quick add from other apps</h3>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Send bank alerts or notes to your inbox from Shortcuts, Zapier, n8n or a script. They’re read
			the same way as a paste: {claudeOn
				? 'patterns first, then Claude'
				: 'by the patterns only, since Claude is off'}, and you review each one before it’s saved. A
			token can only add to your inbox; it can’t read or change anything else.
		</p>
	</div>

	{#if newToken}
		<!-- Shown once: the token isn't stored, so it can't be shown again after this. -->
		<div
			class="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
			role="status"
		>
			<p class="text-sm font-medium">Copy your token now. It won’t be shown again.</p>
			<div class="flex items-center gap-2">
				<code
					class="min-w-0 flex-1 truncate rounded-md bg-white px-2 py-1.5 font-mono text-xs dark:bg-gray-900"
					>{newToken}</code
				>
				<button type="button" class={button} onclick={() => copy(newToken, 'token')}>
					{#if copied === 'token'}
						<Check class="size-4" aria-hidden="true" /> Copied
					{:else}
						<Copy class="size-4" aria-hidden="true" /> Copy
					{/if}
				</button>
			</div>
			<p class="text-xs text-gray-600 dark:text-gray-400">
				Anyone with it can add items to your inbox, so keep it in your automation’s secret settings,
				not in a shared file. The example below already has it filled in.
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
				autocapitalize="words"
				name="name"
				value="Email alerts"
				maxlength={TOKEN_NAME_MAX}
				required
				aria-invalid={form?.error && !form.revoked ? true : undefined}
				aria-describedby="token-name-help"
				class="min-w-0 flex-1 rounded-md border-gray-300 text-sm focus:border-gray-500 focus:ring-gray-500 dark:border-gray-700 dark:bg-gray-900"
			/>
			<button type="submit" class={button} disabled={creating}>
				<Plus class="size-4" aria-hidden="true" />
				Make token
			</button>
		</div>
		<p id="token-name-help" class={muted}>
			{#if form?.error}
				<span class="text-red-600 dark:text-red-400">{form.error}</span>
			{:else}
				A name to tell it apart, like the app or automation that uses it.
			{/if}
		</p>
	</form>

	<!-- Tokens -->
	<div>
		<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400">Tokens · {tokens.length}</h4>
		{#if tokens.length === 0}
			<p
				class="mt-2 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-gray-700"
			>
				None yet.
			</p>
		{:else}
			<ul
				class="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
			>
				{#each tokens as token (token.id)}
					<li class="flex items-center gap-3 px-3 py-2.5">
						<KeyRound class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-sm">
								{token.name}
								<span class="font-mono text-xs text-gray-500">…{token.hint}</span>
							</span>
							<span class={muted}>
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
			<p class="mt-2 {muted}">
				Revoking stops that automation right away. Items it already sent stay in your inbox.
			</p>
		{/if}
	</div>

	<!-- How to use it -->
	<div class="flex flex-col gap-2">
		<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400">How to send one</h4>
		<div class="rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-800">
			<p>
				Send a <span class="font-medium">POST</span> request with the token and the message. Several alerts
				in one message become separate items, one per line.
			</p>
			<div class="mt-3 overflow-hidden rounded-md bg-gray-50 dark:bg-gray-900">
				<div
					class="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-gray-800"
				>
					<span class={muted}>Example with curl</span>
					<button
						type="button"
						class="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
						onclick={() => copy(example, 'example')}
					>
						{#if copied === 'example'}
							<Check class="size-3.5" aria-hidden="true" /> Copied
						{:else}
							<Copy class="size-3.5" aria-hidden="true" /> Copy
						{/if}
					</button>
				</div>
				<pre class="overflow-x-auto p-3 text-[11px] leading-snug">{example}</pre>
			</div>
			<details class="mt-3">
				<summary class="cursor-pointer text-gray-500 dark:text-gray-400">What comes back</summary>
				<p class="mt-2 text-gray-600 dark:text-gray-400">
					It answers right away with status 202, before the items are read, so your automation
					doesn’t wait. When they’re read, or if they couldn’t be, your devices with notifications
					on get a push.
				</p>
				<pre
					class="mt-2 overflow-x-auto rounded-md bg-gray-50 p-3 text-[11px] leading-snug dark:bg-gray-900">{response}</pre>
				<p class="mt-2 text-gray-600 dark:text-gray-400">
					If nothing was saved, it answers with an error status and <code class="text-xs"
						>{'{ "error": "…" }'}</code
					>: 401 for a missing or revoked token, 400 for a bad message or a full inbox, 429 when
					over a limit.
				</p>
			</details>
		</div>
	</div>

	<!-- Limits -->
	<div class="text-sm">
		<p class="font-medium">Limits</p>
		<ul class="mt-1 list-disc space-y-0.5 pl-5 text-gray-600 dark:text-gray-400">
			<li>
				{perTime(limits.perSecond, 'second')} and {limits.perMinute} a minute, shared with Quick add in
				the app
			</li>
			<li>Up to {limits.perRequest} items per request, and {limits.inbox} waiting in your inbox</li>
			<li>
				Claude readings count toward the same {readingsPerDay} a day{claudeOn
					? ''
					: ' (none while Claude is off)'}
			</li>
		</ul>
		<p class="mt-2 {muted}">
			Over a limit, the request is refused with status 429 and a message saying why. Wait a moment
			and send it again.
		</p>
	</div>
</div>
