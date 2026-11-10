/**
 * Tracks a CSS media query. `current` is `undefined` during server rendering and the first
 * client render (so hydration matches the server HTML), then the real value once mounted.
 * Must be called during component initialisation (it uses $effect).
 */
export function createMediaQuery(query: string) {
	let current = $state<boolean | undefined>(undefined);

	$effect(() => {
		const media = window.matchMedia(query);
		current = media.matches;
		const onChange = () => (current = media.matches);
		media.addEventListener('change', onChange);
		return () => media.removeEventListener('change', onChange);
	});

	return {
		get current() {
			return current;
		}
	};
}

/** Tailwind's `sm` breakpoint: the grid shows at this width and up, the compact list below. */
export const WIDE_SCREEN = '(min-width: 40rem)';
