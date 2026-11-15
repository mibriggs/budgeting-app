<!--
	@component
	The icon for a kind of payment method: card for credit, bank for debit, phone for pay apps,
	banknote for cash. Decorative (hidden from screen readers).

	<PaymentMethodIcon kind="credit" class="size-4" />
-->
<script lang="ts">
	import Banknote from '@lucide/svelte/icons/banknote';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import type { PaymentMethodKind } from '#lib/payment-methods.ts';

	let { kind, class: className = '' }: { kind: PaymentMethodKind; class?: string } = $props();

	const ICONS = { credit: CreditCard, debit: Landmark, p2p: Smartphone, cash: Banknote };
	const Icon = $derived(ICONS[kind]);
</script>

<Icon class={className} aria-hidden="true" />
