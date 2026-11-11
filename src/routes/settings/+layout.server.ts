import { redirect } from '@sveltejs/kit';
import { displayName } from '#lib/server/user.ts';
import type { LayoutServerLoad } from './$types';

// Shared by every settings section. Each section's own load checks sign-in too, since layout and
// page loads run at the same time.
export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	return { displayName: displayName(locals.user) };
};
