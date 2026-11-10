<!--
	@component
	Full transaction table for wider screens. Replaced by the Drizzle Studio–style
	virtualized grid in a later stage.
-->
<script lang="ts">
	import { categoryIcon } from '#lib/category-icons.ts';
	import { formatDate } from '#lib/date-range.ts';
	import { formatCents } from '#lib/money.ts';
	import type { TransactionRow } from '#lib/server/budget/transactions.ts';

	let { rows }: { rows: TransactionRow[] } = $props();
</script>

<div class="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-800">
	<table class="w-full text-left text-sm">
		<thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
			<tr>
				<th class="px-3 py-2 font-medium">Date</th>
				<th class="px-3 py-2 font-medium">Name</th>
				<th class="px-3 py-2 font-medium">Category</th>
				<th class="px-3 py-2 text-right font-medium">Amount</th>
				<th class="px-3 py-2 font-medium">Notes</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100 dark:divide-gray-800">
			{#each rows as row (row.id)}
				{@const Icon = categoryIcon(row.categoryIcon)}
				<tr>
					<td class="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
					<td class="px-3 py-2">{row.name}</td>
					<td class="px-3 py-2">
						<span class="flex items-center gap-2">
							<Icon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
							{row.categoryName}
						</span>
					</td>
					<td class="px-3 py-2 text-right whitespace-nowrap tabular-nums">
						{formatCents(row.amountCents)}
					</td>
					<td class="px-3 py-2 text-gray-500">{row.notes ?? ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
