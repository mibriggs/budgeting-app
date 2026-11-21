<!--
	Settings → AI. One switch, saved to the account (every device), off unless the user turns it on:
	whether Quick add may ask Claude when the built-in patterns can't fill everything in. Greyed
	out when the server has no Anthropic API key, since Claude can't run there either way. While
	it's on, shows today's Claude readings against the daily cap (CLAUDE_READINGS_PER_DAY).
-->
<script lang="ts">
	import { Switch } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Saved as soon as the switch moves; put back if the save fails.
	// svelte-ignore state_referenced_locally
	let enabled = $state(data.aiEnabled);
	async function setEnabled(value: boolean) {
		enabled = value;
		try {
			const response = await fetch('/settings/ai', {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({ enabled: value })
			});
			if (response.ok) return;
		} catch {
			// Offline or the request failed: reported below.
		}
		enabled = !value;
		toast.error(
			navigator.onLine
				? 'Couldn’t save that. Please try again.'
				: "You're offline. That needs a connection."
		);
	}

	const on = $derived(enabled && data.modelAvailable);
	const { used, limit } = $derived(data.readings);
</script>

<svelte:head>
	<title>AI · Settings · CentJar</title>
</svelte:head>

<section aria-labelledby="section-title" class="flex max-w-2xl flex-col gap-4">
	<div>
		<h2 id="section-title" class="text-lg font-semibold">AI</h2>
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Quick add reads pasted bank alerts and notes with built-in patterns. You can also let Claude,
			an AI model made by Anthropic, fill in what the patterns miss.
		</p>
	</div>

	<div
		class="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-800"
	>
		<Switch.Root
			id="ai-enabled"
			checked={on}
			disabled={!data.modelAvailable}
			onCheckedChange={setEnabled}
			aria-describedby={data.modelAvailable ? undefined : 'ai-no-key'}
			class="mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gray-900 data-[state=unchecked]:bg-gray-300 dark:data-[state=checked]:bg-white dark:data-[state=unchecked]:bg-gray-700"
		>
			<Switch.Thumb
				class="block size-4 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-4 dark:data-[state=checked]:bg-gray-900"
			/>
		</Switch.Root>
		<label for="ai-enabled" class="text-sm">
			Use Claude to read Quick add messages
			<span class="block text-xs text-gray-500 dark:text-gray-400">
				Off unless you turn it on. Applies to your account on every device.
			</span>
		</label>
	</div>

	{#if !data.modelAvailable}
		<p
			id="ai-no-key"
			class="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
		>
			AI reading isn’t set up on this server (no Anthropic API key), so only the patterns are used.
		</p>
	{:else}
		<div
			class="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300"
		>
			{#if on}
				<p class="font-medium text-gray-900 dark:text-white">While it’s on</p>
				<p class="mt-1">
					Patterns still go first. Claude is asked only when they can’t fill in everything, and you
					still review every item before it’s saved.
				</p>
				<div class="mt-3 flex flex-col gap-1.5">
					<div
						class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
						role="img"
						aria-label="{used} of {limit} Claude readings used today"
					>
						<div
							class="h-full rounded-full bg-gray-900 dark:bg-white"
							style:width="{Math.min(used / limit, 1) * 100}%"
						></div>
					</div>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{used} of {limit} Claude readings used today. {used >= limit
							? 'Until midnight, the patterns read new items on their own.'
							: 'Resets at midnight.'} Items the patterns read alone don’t count.
					</p>
				</div>
			{:else}
				<p class="font-medium text-gray-900 dark:text-white">While it’s off</p>
				<p class="mt-1">
					Only the built-in patterns read your messages, and nothing is sent to an AI service. When
					a pattern can’t find something, like the category, the item waits in your inbox for you to
					fill in.
				</p>
			{/if}
		</div>
	{/if}

	<div class="text-sm">
		<p class="font-medium">What Claude gets when it’s asked</p>
		<!-- Keep in step with buildUserPrompt in src/lib/quick-add/prompt.ts. -->
		<ul class="mt-1 list-disc space-y-0.5 pl-5 text-gray-600 dark:text-gray-400">
			<li>The pasted message, with links removed, up to 500 characters</li>
			<li>Your category and payment method names (with last 4 digits if you added them)</li>
			<li>Names and categories of a few of your recent expenses</li>
		</ul>
		<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
			Turning it off stops new requests right away. Items Claude already read keep their “Read by
			Claude” label.
		</p>
	</div>
</section>
