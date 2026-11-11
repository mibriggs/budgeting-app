<script lang="ts">
	import { Popover, RangeCalendar, type DateRange as CalendarRange } from 'bits-ui';
	import { CalendarDate, parseDate, type DateValue } from '@internationalized/date';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { RANGE_PRESETS, type DateRange } from '#lib/date-range.ts';
	import { updateQuery } from '#lib/url.ts';
	import { focusCalendarDay } from '#lib/calendar.ts';
	import { today } from '#lib/dates.ts';

	let { range }: { range: DateRange } = $props();

	let open = $state(false);
	let popoverContent = $state<HTMLElement | null>(null);
	let selection = $state<CalendarRange>({ start: undefined, end: undefined });
	let placeholder = $state<DateValue>();

	/** Link to this page with a new range, keeping other query params (like the tab). */
	function rangeHref(params: { range?: string; from?: string; to?: string }) {
		const query = updateQuery(page.url.search, {
			range: params.range ?? null,
			from: params.from ?? null,
			to: params.to ?? null
		});
		return resolve(`/transactions${query}`);
	}

	function onOpenChange(isOpen: boolean) {
		if (!isOpen) return;
		// Open with nothing selected, on the custom range's first day if one is being viewed,
		// otherwise on today. That date is also the one that gets keyboard focus.
		selection = { start: undefined, end: undefined };
		placeholder = parseDate((range.preset === 'custom' ? range.from : today()).toString());
	}

	function onSelect(value: CalendarRange) {
		// The first click sets only the start; navigate once both ends are picked.
		if (!value.start || !value.end) return;
		open = false;
		goto(rangeHref({ range: 'custom', from: value.start.toString(), to: value.end.toString() }), {
			reset: false
		});
	}

	// Calendar bounds: the year dropdown runs from 1940 to this year.
	const FIRST_YEAR = 1940;
	const thisYear = new Date().getFullYear();
	const years = Array.from({ length: thisYear - FIRST_YEAR + 1 }, (_, i) => thisYear - i);
	const minValue = new CalendarDate(FIRST_YEAR, 1, 1);
	const maxValue = new CalendarDate(thisYear, 12, 31);

	const pill =
		'rounded-md px-3 py-1.5 text-sm transition hover:bg-gray-100 dark:hover:bg-gray-800 data-active:bg-gray-900 data-active:text-white dark:data-active:bg-white dark:data-active:text-gray-900';

	const select =
		'cursor-pointer rounded-md border-0 bg-transparent py-1 pr-7 pl-2 text-sm font-semibold hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 dark:bg-transparent dark:hover:bg-gray-800';

	// Band behind the hovered preview and the selected range.
	const cell =
		'p-0 data-highlighted:bg-gray-100 data-range-middle:bg-gray-100 dark:data-highlighted:bg-gray-800 dark:data-range-middle:bg-gray-800';

	const day = [
		'relative flex size-10 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums',
		// Hover, except on the chosen start/end dates.
		'[&:not([data-selection-start],[data-selection-end])]:hover:bg-gray-200 dark:[&:not([data-selection-start],[data-selection-end])]:hover:bg-gray-700',
		// Chosen start and end dates.
		'data-selection-start:bg-gray-900 data-selection-start:text-white data-selection-end:bg-gray-900 data-selection-end:text-white',
		'dark:data-selection-start:bg-white dark:data-selection-start:text-gray-900 dark:data-selection-end:bg-white dark:data-selection-end:text-gray-900',
		// Days from the previous/next month, and dates outside 1940–this year.
		'data-outside-month:text-gray-300 dark:data-outside-month:text-gray-600',
		'data-disabled:pointer-events-none data-disabled:opacity-30',
		// Dot under today's date.
		'data-today:after:absolute data-today:after:bottom-1 data-today:after:left-1/2 data-today:after:size-1 data-today:after:-translate-x-1/2 data-today:after:rounded-full data-today:after:bg-current data-today:after:opacity-60'
	].join(' ');
</script>

<nav aria-label="Date range" class="flex flex-wrap gap-1">
	{#each RANGE_PRESETS as preset (preset.value)}
		<a
			href={rangeHref(preset.value === 'month' ? {} : { range: preset.value })}
			aria-current={range.preset === preset.value ? 'page' : undefined}
			data-active={range.preset === preset.value || undefined}
			class={pill}
			data-sveltekit-reset="false"
		>
			{preset.label}
		</a>
	{/each}

	<Popover.Root bind:open {onOpenChange}>
		<Popover.Trigger class={pill} data-active={range.preset === 'custom' || undefined}>
			Custom
		</Popover.Trigger>
		<Popover.Portal>
			<Popover.Content
				bind:ref={popoverContent}
				onOpenAutoFocus={(event) => focusCalendarDay(event, popoverContent)}
				sideOffset={6}
				align="start"
				collisionPadding={8}
				class="z-50 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
			>
				<RangeCalendar.Root
					bind:value={selection}
					bind:placeholder
					onValueChange={onSelect}
					{minValue}
					{maxValue}
					weekdayFormat="short"
					fixedWeeks
				>
					{#snippet children({ months, weekdays })}
						<RangeCalendar.Header class="mb-2 flex items-center justify-between gap-1">
							<RangeCalendar.PrevButton
								class="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
								aria-label="Previous month"
							>
								<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
									<path
										fill-rule="evenodd"
										d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.83 10l3.94 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
										clip-rule="evenodd"
									/>
								</svg>
							</RangeCalendar.PrevButton>
							<!-- Announced to screen readers when the month changes; the selects are the visible heading. -->
							<RangeCalendar.Heading class="sr-only" />
							<div class="flex items-center">
								<RangeCalendar.MonthSelect monthFormat="short" class={select} />
								<RangeCalendar.YearSelect {years} class={select} />
							</div>
							<RangeCalendar.NextButton
								class="rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
								aria-label="Next month"
							>
								<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
									<path
										fill-rule="evenodd"
										d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.17 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
										clip-rule="evenodd"
									/>
								</svg>
							</RangeCalendar.NextButton>
						</RangeCalendar.Header>

						{#each months as month (month.value)}
							<RangeCalendar.Grid class="border-collapse">
								<RangeCalendar.GridHead>
									<RangeCalendar.GridRow class="flex">
										{#each weekdays as day (day)}
											<RangeCalendar.HeadCell
												class="w-10 text-center text-xs font-normal text-gray-500"
											>
												{day.slice(0, 2)}
											</RangeCalendar.HeadCell>
										{/each}
									</RangeCalendar.GridRow>
								</RangeCalendar.GridHead>
								<RangeCalendar.GridBody>
									{#each month.weeks as week, i (i)}
										<RangeCalendar.GridRow class="flex">
											{#each week as date (date.toString())}
												<!-- The cell draws the band (hover preview + selected range); the day draws the endpoints. -->
												<RangeCalendar.Cell {date} month={month.value} class={cell}>
													<RangeCalendar.Day class={day} />
												</RangeCalendar.Cell>
											{/each}
										</RangeCalendar.GridRow>
									{/each}
								</RangeCalendar.GridBody>
							</RangeCalendar.Grid>
						{/each}
					{/snippet}
				</RangeCalendar.Root>
				<p class="mt-2 text-xs text-gray-500">Pick a start date, then an end date.</p>
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</nav>
