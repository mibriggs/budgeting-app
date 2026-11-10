// Calendar dates without a time or time zone, so an expense on 2026-11-30 stays on
// 2026-11-30 no matter where it's viewed. Uses the Temporal API (via polyfill until
// browsers and Node ship it natively).
//
//   const d = Temporal.PlainDate.from('2026-11-10');
//   d.add({ months: 1 });                 // 2026-12-10
//   d.toPlainYearMonth().toString();      // '2026-11'
//   Temporal.PlainDate.compare(a, b);     // -1 | 0 | 1
//
// Shared by server and browser code. Database columns map to these types in
// src/lib/server/db/columns.ts, and src/hooks.ts lets load functions return them.

import { Temporal } from 'temporal-polyfill';

export { Temporal };

export type PlainDate = Temporal.PlainDate;
export type PlainYearMonth = Temporal.PlainYearMonth;

/** Today's date in the given IANA time zone (defaults to the runtime's own zone). */
export function today(timeZone?: string): PlainDate {
	return Temporal.Now.plainDateISO(timeZone);
}

/** The current month in the given IANA time zone (defaults to the runtime's own zone). */
export function currentMonth(timeZone?: string): PlainYearMonth {
	return today(timeZone).toPlainYearMonth();
}
