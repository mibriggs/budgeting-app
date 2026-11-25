// The Scriptable scripts offered on Settings → Widget (budget: not listed there yet, in testing). Each is one paste-able file: a short
// header with the settings the user may change, then common.js, then the widget's own code.
// The .js files are plain Scriptable code (not modules), imported here as text.

import budget from './budget.js?raw';
import common from './common.js?raw';
import net from './net.js?raw';
import top from './top.js?raw';

export type WidgetKind = 'net' | 'top' | 'budget';

export const WIDGETS: Record<WidgetKind, { title: string; name: string; body: string }> = {
	net: { title: 'Net cash flow', name: 'CentJar Net', body: net },
	top: { title: 'Top spending', name: 'CentJar Top Spending', body: top },
	budget: { title: 'Budget', name: 'CentJar Budget', body: budget }
};

/**
 * The full script for one widget. `token` is filled in only when the user has just made one
 * and copies straight away; otherwise it says PASTE_TOKEN_HERE.
 */
export function widgetScript(kind: WidgetKind, baseUrl: string, token?: string): string {
	const header = [
		`// CentJar · ${WIDGETS[kind].title} widget for Scriptable (https://scriptable.app)`,
		'// Set up in CentJar: Settings → Widget. Works in any Home Screen size and on the Lock Screen;',
		'// change the size on the widget itself, nothing here needs editing.',
		'',
		'// Your widget token (keep it private; revoke it in Settings → Widget if it leaks).',
		`const TOKEN = '${token ?? 'PASTE_TOKEN_HERE'}';`,
		`const BASE_URL = '${baseUrl.replace(/\/+$/, '')}';`,
		"// Size shown when you run the script in the Scriptable app: 'small', 'medium' or 'large'.",
		"const PREVIEW = 'medium';",
		...(kind === 'top'
			? [
					'',
					'// Medium and large widgets. What each category shows: its share of this month’s',
					"// spending ('share') or how much of its budget is used ('budget').",
					"const SHOW = 'share';",
					"// As a bar under each category ('bars') or a line of text ('list').",
					"const LAYOUT = 'bars';"
				]
			: []),
		''
	].join('\n');
	return `${header}\n${common}\n${WIDGETS[kind].body}`;
}
