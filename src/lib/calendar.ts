/**
 * For a Bits UI calendar inside a popover: use as the popover content's `onOpenAutoFocus` so
 * opening it focuses the calendar's current day (the selected date, else today) instead of the
 * first focusable element, which is the month <select>. Focusing a <select> on a phone can pop
 * open its picker straight away; a focused day just lets arrow keys move between dates.
 *
 *   <Popover.Content bind:ref={content} onOpenAutoFocus={(e) => focusCalendarDay(e, content)}>
 */
export function focusCalendarDay(event: Event, content: HTMLElement | null) {
	event.preventDefault();
	// Wait a tick so the calendar's days are rendered and have their tabindex.
	setTimeout(() => {
		const day = content?.querySelector<HTMLElement>('[data-bits-day][tabindex="0"]');
		(day ?? content)?.focus({ preventScroll: true });
	}, 0);
}
