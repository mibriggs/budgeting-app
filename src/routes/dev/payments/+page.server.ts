// Dev-only mock of Settings → Payment methods and the "Paid with" field on the add-expense form
// (future-plans, "Payment methods"). Sample data only: no database, nothing is saved.
// 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
