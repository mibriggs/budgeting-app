// Light / dark / system theme, chosen from the user menu and saved per device (localStorage).
// "system" follows the device setting and keeps following it if it changes.
// src/app.html applies the saved choice before the first paint; keep its 'theme' key in sync.

export type ThemeChoice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readSaved(): ThemeChoice {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		return saved === 'light' || saved === 'dark' ? saved : 'system';
	} catch {
		return 'system';
	}
}

function apply(choice: ThemeChoice) {
	const dark = choice === 'dark' || (choice === 'system' && matchMedia(DARK_QUERY).matches);
	document.documentElement.classList.toggle('dark', dark);
}

class Theme {
	/** The user's choice. "system" until the browser has read the saved value. */
	choice = $state<ThemeChoice>('system');

	/** Call once from the root layout (inside $effect). Returns a cleanup function. */
	init() {
		this.choice = readSaved();
		apply(this.choice);
		const media = matchMedia(DARK_QUERY);
		const onSystemChange = () => {
			if (this.choice === 'system') apply('system');
		};
		media.addEventListener('change', onSystemChange);
		return () => media.removeEventListener('change', onSystemChange);
	}

	set(choice: ThemeChoice) {
		this.choice = choice;
		try {
			if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
			else localStorage.setItem(STORAGE_KEY, choice);
		} catch {
			// Storage blocked (e.g. private mode): the choice still applies until the page closes.
		}
		apply(choice);
	}
}

export const theme = new Theme();
