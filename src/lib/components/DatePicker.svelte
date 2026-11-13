<!--
	@component
	A date field: a button showing the date ("Nov 12, 2026") that opens a Bits UI calendar in a
	popover, with ‹ › month arrows around month and year dropdowns (like the transactions
	page's custom range). The field doesn't shrink when pressed, since it acts as an input. Works inside dialogs (the popover sits above them).
	Same look as the add-entry dialog's date field.

	<DatePicker bind:value={start} labelledby="start-label" min={...} max={...} />
-->
<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { CalendarDate, parseDate as parseCalendarDate } from '@internationalized/date';
	import { Calendar, Popover } from 'bits-ui';
	import { focusCalendarDay } from '#lib/calendar.ts';
	import { Temporal, type PlainDate } from '#lib/dates.ts';
	import { formatDate } from '#lib/date-range.ts';

	let {
		value = $bindable(null),
		id,
		labelledby,
		invalid = false,
		describedby,
		min = Temporal.PlainDate.from('1940-01-01'),
		max = Temporal.PlainDate.from({ year: new Date().getFullYear() + 1, month: 12, day: 31 }),
		placeholder = 'Pick a date',
		class: className = ''
	}: {
		value?: PlainDate | null;
		id?: string;
		/** Id of the visible label (the button also reads out the chosen date). */
		labelledby?: string;
		invalid?: boolean;
		describedby?: string;
		min?: PlainDate;
		max?: PlainDate;
		placeholder?: string;
		class?: string;
	} = $props();

	let open = $state(false);
	let content = $state<HTMLElement | null>(null);
	const valueId = $props.id();

	const toCalendar = (d: PlainDate) => parseCalendarDate(d.toString());
	const calendarValue = $derived(value ? toCalendar(value) : undefined);
	const minValue = $derived(new CalendarDate(min.year, min.month, min.day));
	const maxValue = $derived(new CalendarDate(max.year, max.month, max.day));
	// Newest first, like the add dialog.
	const years = $derived(Array.from({ length: max.year - min.year + 1 }, (_, i) => max.year - i));

	const arrow = 'rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800';
	const select =
		'cursor-pointer rounded-md border-0 bg-transparent py-1 pr-7 pl-2 text-sm font-semibold hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 dark:bg-transparent dark:hover:bg-gray-800';
	const day = [
		'relative flex size-9 cursor-pointer items-center justify-center rounded-md text-sm tabular-nums',
		'hover:bg-gray-100 dark:hover:bg-gray-800',
		'data-selected:bg-gray-900 data-selected:text-white dark:data-selected:bg-white dark:data-selected:text-gray-900',
		'data-outside-month:text-gray-300 dark:data-outside-month:text-gray-600',
		'data-disabled:pointer-events-none data-disabled:opacity-30',
		'data-today:after:absolute data-today:after:bottom-1 data-today:after:left-1/2 data-today:after:size-1 data-today:after:-translate-x-1/2 data-today:after:rounded-full data-today:after:bg-current data-today:after:opacity-60'
	].join(' ');
</script>

<Popover.Root bind:open>
	<!-- data-no-press: a field, not a button, so it skips the press-to-shrink effect. -->
	<Popover.Trigger
		{id}
		data-no-press
		class="flex w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 focus:border-gray-500 focus:ring-gray-500 aria-invalid:border-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 {className}"
		aria-labelledby={labelledby ? `${labelledby} ${valueId}` : undefined}
		aria-describedby={describedby}
		aria-invalid={invalid || undefined}
	>
		<span id={valueId} class={['truncate', !value && 'text-gray-400']}>
			{value ? formatDate(value) : placeholder}
		</span>
		<CalendarIcon class="size-4 shrink-0 text-gray-500" aria-hidden="true" />
	</Popover.Trigger>
	<Popover.Portal>
		<Popover.Content
			bind:ref={content}
			onOpenAutoFocus={(event) => focusCalendarDay(event, content)}
			sideOffset={6}
			align="start"
			collisionPadding={8}
			class="z-60 rounded-lg border border-gray-200 bg-white p-3 text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
		>
			<Calendar.Root
				type="single"
				value={calendarValue}
				onValueChange={(next) => {
					if (!next) return;
					value = Temporal.PlainDate.from(next.toString());
					open = false;
				}}
				{minValue}
				{maxValue}
				preventDeselect
				weekdayFormat="short"
				fixedWeeks
			>
				{#snippet children({ months, weekdays })}
					<Calendar.Header class="mb-2 flex items-center justify-between gap-1">
						<Calendar.PrevButton class={arrow} aria-label="Previous month">
							<ChevronLeft class="size-4" aria-hidden="true" />
						</Calendar.PrevButton>
						<!-- Announced to screen readers when the month changes; the selects are the visible heading. -->
						<Calendar.Heading class="sr-only" />
						<div class="flex items-center">
							<Calendar.MonthSelect monthFormat="short" class={select} />
							<Calendar.YearSelect {years} class={select} />
						</div>
						<Calendar.NextButton class={arrow} aria-label="Next month">
							<ChevronRight class="size-4" aria-hidden="true" />
						</Calendar.NextButton>
					</Calendar.Header>
					{#each months as month (month.value)}
						<Calendar.Grid>
							<Calendar.GridHead>
								<Calendar.GridRow class="flex">
									{#each weekdays as weekday (weekday)}
										<Calendar.HeadCell class="w-9 text-center text-xs font-normal text-gray-500">
											{weekday.slice(0, 2)}
										</Calendar.HeadCell>
									{/each}
								</Calendar.GridRow>
							</Calendar.GridHead>
							<Calendar.GridBody>
								{#each month.weeks as week, i (i)}
									<Calendar.GridRow class="flex">
										{#each week as cellDate (cellDate.toString())}
											<Calendar.Cell date={cellDate} month={month.value} class="p-0">
												<Calendar.Day class={day} />
											</Calendar.Cell>
										{/each}
									</Calendar.GridRow>
								{/each}
							</Calendar.GridBody>
						</Calendar.Grid>
					{/each}
				{/snippet}
			</Calendar.Root>
		</Popover.Content>
	</Popover.Portal>
</Popover.Root>
