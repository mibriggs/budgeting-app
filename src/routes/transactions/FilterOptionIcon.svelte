<!--
	@component
	The icon for a filter option: the category's icon, the payment method's kind, or a blank of
	the same size ("Not recorded"). Decorative.
-->
<script lang="ts">
	import { categoryIcon } from '#lib/category-icons.ts';
	import PaymentMethodIcon from '#lib/components/PaymentMethodIcon.svelte';
	import type { FilterOption } from './filters.ts';

	let { icon, class: className = '' }: { icon: FilterOption['icon']; class?: string } = $props();
</script>

{#if icon && 'category' in icon}
	{@const Icon = categoryIcon(icon.category)}
	<Icon class="{className} shrink-0 text-gray-500" aria-hidden="true" />
{:else if icon && 'method' in icon}
	<PaymentMethodIcon kind={icon.method} class="{className} shrink-0 text-gray-500" />
{:else}
	<span class="{className} shrink-0" aria-hidden="true"></span>
{/if}
