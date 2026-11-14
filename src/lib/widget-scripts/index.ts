// The two Scriptable scripts offered on Settings → Widget. Each is one paste-able file: a short
// header with the settings the user may change, then common.js, then the widget's own code.
// The .js files are plain Scriptable code (not modules), imported here as text.

import common from './common.js?raw';
import net from './net.js?raw';
import top from './top.js?raw';

export type WidgetKind = 'net' | 'top';

export const WIDGETS: Record<WidgetKind, { title: string; name: string; body: string }> = {
	net: { title: 'Net cash flow', name: 'CentJar Net', body: net },
	top: { title: 'Top spending', name: 'CentJar Top Spending', body: top }
};

/**
 * The full script for one widget. `token` is filled in only when the user has just made one
 * and copies straight away; otherwise it says PASTE_TOKEN_HERE.
 */
export function widgetScript(kind: WidgetKind, baseUrl: string, token?: string): string {
	const header = [
		`// CentJar · ${WIDGETS[kind].title} widget for Scriptable (https://scriptable.app)`,
		'// Set up in CentJar: Settings → Widget. Works as a small or medium Home Screen widget.',
		'',
		'// Your widget token (keep it private; revoke it in Settings → Widget if it leaks).',
		`const TOKEN = '${token ?? 'PASTE_TOKEN_HERE'}';`,
		`const BASE_URL = '${baseUrl.replace(/\/+$/, '')}';`,
		"// Size shown when you run the script in the Scriptable app: 'small' or 'medium'.",
		"const PREVIEW = 'medium';",
		''
	].join('\n');
	return `${header}\n${common}\n${WIDGETS[kind].body}`;
}
