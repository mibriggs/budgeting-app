// Dev-only mock of editing an expense on a phone (how it opens, dialog vs bottom sheet)
// (future-plans, "Editing expenses and income"). Sample rows only: nothing is saved.
// 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
