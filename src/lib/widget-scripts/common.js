// ─── Shared by both CentJar widgets. Nothing to change below this line. ───
//
// Not a module: Settings → Widget joins a short header (TOKEN, BASE_URL, PREVIEW), this file
// and one widget's file into a single script for Scriptable (https://scriptable.app).
// Plain function syntax only, and no template literals, so the text can be pasted as is.

const CACHE_FILE = 'centjar-widget.json';
const files = FileManager.local();
const cachePath = files.joinPath(files.documentsDirectory(), CACHE_FILE);
const family = config.widgetFamily || PREVIEW;
const isSmall = family === 'small';

// Colours that follow the phone's light/dark setting.
function dyn(light, dark) {
	return Color.dynamic(new Color(light), new Color(dark));
}
const TEXT = dyn('#111827', '#f9fafb');
const MUTED = dyn('#6b7280', '#9ca3af');
const WARN = dyn('#b45309', '#fbbf24');
const UP = new Color('#16a34a');
const DOWN = new Color('#dc2626');
const WHITE = new Color('#ffffff');

// Saved last good response, shown (dimmed) when a new one can't be had.
function readCache() {
	try {
		if (files.fileExists(cachePath)) return JSON.parse(files.readString(cachePath));
	} catch (e) {
		// Unreadable: treat as nothing saved.
	}
	return null;
}
function writeCache(data) {
	try {
		files.writeString(cachePath, JSON.stringify(data));
	} catch (e) {
		// Not saving only means no fallback next time.
	}
}
function clearCache() {
	try {
		if (files.fileExists(cachePath)) files.remove(cachePath);
	} catch (e) {
		// Nothing to do.
	}
}

function looksRight(d) {
	return (
		!!d &&
		typeof d.asOf === 'string' &&
		!!d.net &&
		typeof d.net.netCents === 'number' &&
		Array.isArray(d.topCategories)
	);
}

/**
 * Fetches this month's numbers. Returns { data } when fresh; { data, notice } with the saved
 * copy when offline ('offline') or the server answered badly ('error'); or { problem } when
 * there's nothing to show: 'no-token', 'token' (revoked or wrong), 'offline', 'error'.
 */
async function load() {
	if (!TOKEN || TOKEN === 'PASTE_TOKEN_HERE') return { problem: 'no-token' };
	const req = new Request(BASE_URL + '/api/widget');
	req.headers = { Authorization: 'Bearer ' + TOKEN };
	req.timeoutInterval = 15;
	let body;
	try {
		body = await req.loadString();
	} catch (e) {
		const saved = readCache();
		return saved ? { data: saved, notice: 'offline' } : { problem: 'offline' };
	}
	const status = req.response ? req.response.statusCode : 0;
	if (status === 401) {
		// Revoked: stop showing the numbers.
		clearCache();
		return { problem: 'token' };
	}
	let data = null;
	if (status === 200) {
		try {
			data = JSON.parse(body);
		} catch (e) {
			data = null;
		}
	}
	if (looksRight(data)) {
		writeCache(data);
		return { data: data };
	}
	const saved = readCache();
	return saved ? { data: saved, notice: 'error' } : { problem: 'error' };
}

// "$351.66" under $1,000, "$2.3K" above. No sign: the widget shows direction separately.
function money(cents) {
	const dollars = Math.abs(cents) / 100;
	if (dollars >= 999950) return '$' + (dollars / 1000000).toFixed(1) + 'M';
	if (dollars >= 999.995) return '$' + (dollars / 1000).toFixed(1) + 'K';
	return '$' + dollars.toFixed(2);
}

function sameDay(a, b) {
	return a.toDateString() === b.toDateString();
}
function isToday(iso) {
	return sameDay(new Date(iso), new Date());
}
// "1:49 PM" today, "Yesterday 1:49 PM", or "Nov 12".
function whenText(iso) {
	const at = new Date(iso);
	const now = new Date();
	const time = new DateFormatter();
	time.dateFormat = 'h:mm a';
	if (sameDay(at, now)) return time.string(at);
	const yesterday = new Date(now.getTime());
	yesterday.setDate(now.getDate() - 1);
	if (sameDay(at, yesterday)) return 'Yesterday ' + time.string(at);
	const day = new DateFormatter();
	day.dateFormat = 'MMM d';
	return day.string(at);
}

// ─── Drawing helpers ───

function addText(parent, value, font, color, lines) {
	const t = parent.addText(value);
	t.font = font;
	t.textColor = color || TEXT;
	if (lines) t.lineLimit = lines;
	return t;
}

function symbolImage(name, font) {
	const symbol = SFSymbol.named(name) || SFSymbol.named('tag');
	if (font) symbol.applyFont(font);
	return symbol.image;
}

/** An SF Symbol in a filled circle. */
function addChip(parent, name, size, background, tint) {
	const chip = parent.addStack();
	chip.size = new Size(size, size);
	chip.cornerRadius = size / 2;
	chip.backgroundColor = background;
	chip.centerAlignContent();
	const image = chip.addImage(symbolImage(name, Font.semiboldSystemFont(size * 0.45)));
	image.imageSize = new Size(size * 0.55, size * 0.55);
	image.tintColor = tint;
	return chip;
}

/** A thin rounded bar, `fraction` (0–1) of `width` filled. */
function addBar(parent, width, fraction, fill, track) {
	const bar = parent.addStack();
	bar.size = new Size(width, 6);
	bar.cornerRadius = 3;
	bar.backgroundColor = track;
	const filled = Math.max(0, Math.min(1, fraction)) * width;
	if (filled > 0) {
		const part = bar.addStack();
		part.size = new Size(Math.max(filled, 6), 6);
		part.cornerRadius = 3;
		part.backgroundColor = fill;
	}
	bar.addSpacer();
	return bar;
}

/**
 * "Updated 1:49 PM", or why the numbers are old ("Offline · 1:49 PM") in amber. `short` drops
 * the icon and the word "Updated" (for a header).
 */
function addFooter(parent, result, short) {
	const warn = !!result.notice || !isToday(result.data.asOf);
	const when = whenText(result.data.asOf);
	let label = short ? when : 'Updated ' + when;
	let icon = 'clock';
	if (result.notice === 'offline') {
		label = 'Offline · ' + when;
		icon = 'wifi.slash';
	} else if (result.notice === 'error') {
		label = 'Couldn’t update · ' + when;
		icon = 'exclamationmark.triangle';
	}
	const row = parent.addStack();
	row.centerAlignContent();
	if (!short || warn) {
		const image = row.addImage(symbolImage(icon));
		image.imageSize = new Size(9, 9);
		image.tintColor = warn ? WARN : MUTED;
		row.addSpacer(3);
	}
	addText(row, label, Font.mediumSystemFont(10), warn ? WARN : MUTED, 1);
	return row;
}

const PROBLEMS = {
	'no-token': ['key', 'Paste your token', 'Make one in CentJar: Settings → Widget'],
	token: ['key', 'Widget needs a new token', 'Settings → Widget'],
	offline: ['icloud.slash', 'Can’t reach CentJar', 'Trying again soon.'],
	error: ['exclamationmark.triangle', 'Couldn’t load your numbers', 'Trying again soon.']
};

/** The whole widget is a message: nothing to show, or showing old numbers would mislead. */
function drawProblem(widget, problem, chipColor) {
	const p = PROBLEMS[problem];
	widget.addSpacer();
	const box = widget.addStack();
	if (isSmall) box.layoutVertically();
	box.centerAlignContent();
	addChip(box, p[0], 40, chipColor, MUTED);
	box.addSpacer(isSmall ? 8 : 12);
	const words = box.addStack();
	words.layoutVertically();
	if (isSmall) words.centerAlignContent();
	const title = addText(words, p[1], Font.semiboldSystemFont(13), TEXT, 2);
	words.addSpacer(2);
	const body = addText(words, p[2], Font.systemFont(11), MUTED, 2);
	if (isSmall) {
		title.centerAlignText();
		body.centerAlignText();
	}
	widget.addSpacer();
	return problem === 'no-token' || problem === 'token' ? BASE_URL + '/settings/widget' : BASE_URL;
}

/** Shows the widget (or a preview when run in the app) and tells iOS when to check again. */
async function finish(widget, url) {
	widget.url = url;
	widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
	if (config.runsInWidget) Script.setWidget(widget);
	else if (PREVIEW === 'small') await widget.presentSmall();
	else await widget.presentMedium();
	Script.complete();
}
