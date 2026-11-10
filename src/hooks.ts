import type { Transport } from '@sveltejs/kit/hooks';
import { Temporal } from '#lib/dates.ts';

// Lets load functions and form actions return Temporal dates; they arrive in the
// browser as Temporal objects instead of failing to serialize.
export const transport: Transport = {
	PlainDate: {
		encode: (value) => value instanceof Temporal.PlainDate && value.toString(),
		decode: (value: string) => Temporal.PlainDate.from(value)
	},
	PlainYearMonth: {
		encode: (value) => value instanceof Temporal.PlainYearMonth && value.toString(),
		decode: (value: string) => Temporal.PlainYearMonth.from(value)
	}
};
