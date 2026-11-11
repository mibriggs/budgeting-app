import { redirect } from '@sveltejs/kit';
import { listActiveCategories } from '#lib/server/budget/categories.ts';
import type { PageServerLoad } from './$types';

// Settings → Categories: read-only for now (adding, renaming and archiving come later).
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [expense, income] = await Promise.all([
		listActiveCategories(locals.user.id, 'expense'),
		listActiveCategories(locals.user.id, 'income')
	]);
	return { expense, income };
};
