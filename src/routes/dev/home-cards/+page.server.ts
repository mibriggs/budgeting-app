// Dev-only mock of showing and hiding the home page "Credit cards" card
// (empty state, hide from home, the Settings switch). Sample data only: nothing is saved.
// 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
