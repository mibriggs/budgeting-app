import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// /settings has no page of its own: open the first section people need, Budgets.
export const load: PageServerLoad = () => redirect(307, '/settings/budgets');
