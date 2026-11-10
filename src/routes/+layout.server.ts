import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	return {
		signedIn: !!locals.user,
		timezone: locals.user?.timezone ?? null
	};
};
