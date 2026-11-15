// Dev-only mock of the payment method on the transactions list (phone rows and desktop table)
// (future-plans, "Payment methods"). Sample rows only: no database.
// 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
