// ─── Budget widget ───
// This month's budgets together as a ring ("$3,044 of $3,400 budget"), all spending beside it
// (budgets don't cover every category), and the top categories by spending, each in a small ring
// showing how much of its budget is used: 3 on medium, 5 on large with a note each, and what
// was spent with no budget. Small shows the ring and the month's numbers. The Lock Screen sizes
// show the same as text. Designed in the /dev/widgets mock (2026-11-25).
// Not a module: joined after common.js (see that file).

const result = await load();
const BACKGROUND = dyn('#ffffff', '#1c1c1e');
const CHIP = dyn('#f3f4f6', '#2c2c2e');
// Ring colours are drawn into images, which can't follow light/dark, so they're ones that read
// on both backgrounds; the track is the same colour, faint.
const OK_HEX = '#22c55e';
const WARN_HEX = '#f59e0b';
const OVER_HEX = '#ef4444';
const NONE_HEX = '#8e8e93';
const OVER = new Color(OVER_HEX);
// Saved numbers are dimmed: still readable, visibly not current.
const dim = result.notice ? 0.6 : 1;

// Whole dollars with commas ("$3,044"); compact from `compactFrom` cents up ("$12.4K").
function commas(n) {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function dollars(cents, compactFrom) {
	if (Math.abs(cents) >= compactFrom) return money(cents);
	return '$' + commas(Math.round(Math.abs(cents) / 100));
}
/** Big figures: whole dollars up to $9,999. */
function big(cents) {
	return dollars(cents, 1000000);
}
/** Where space is short: whole dollars up to $999, then "$2.3K". */
function short(cents) {
	return dollars(cents, 100000);
}
function pct(fraction) {
	return Math.round(fraction * 100) + '%';
}

/**
 * Over the limit, 80% or more of it used, or fine. Exactly at the limit counts as fine: that's a
 * bill paid in full (rent), not a warning.
 */
function statusOf(spent, limit) {
	if (spent > limit) return 'over';
	if (spent === limit) return 'ok';
	return spent / limit >= 0.8 ? 'close' : 'ok';
}
function hexFor(status) {
	return status === 'over' ? OVER_HEX : status === 'close' ? WARN_HEX : OK_HEX;
}
function hasLimit(c) {
	return c.limitCents !== null && c.limitCents !== undefined && c.limitCents > 0;
}

/**
 * A progress ring as an image, `fraction` (0–1, more is a full ring) filled from the top,
 * clockwise. Drawn at 3x so it stays sharp. An arc is a run of short lines, with round dots at
 * both ends for round caps.
 */
function ringImage(size, stroke, fraction, hex) {
	const scale = 3;
	const d = size * scale;
	const s = stroke * scale;
	const r = (d - s) / 2;
	const mid = d / 2;
	const dc = new DrawContext();
	dc.size = new Size(d, d);
	dc.opaque = false;
	dc.respectScreenScale = false;
	dc.setLineWidth(s);
	dc.setStrokeColor(new Color(hex, 0.22 * dim));
	dc.strokeEllipse(new Rect(s / 2, s / 2, d - s, d - s));
	const f = Math.max(0, Math.min(1, fraction));
	if (f > 0) {
		const color = new Color(hex, dim);
		const steps = Math.max(2, Math.ceil(f * 120));
		const points = [];
		for (let i = 0; i <= steps; i++) {
			const a = -Math.PI / 2 + 2 * Math.PI * f * (i / steps);
			points.push(new Point(mid + r * Math.cos(a), mid + r * Math.sin(a)));
		}
		const path = new Path();
		path.addLines(points);
		dc.addPath(path);
		dc.setStrokeColor(color);
		dc.strokePath();
		dc.setFillColor(color);
		const ends = [points[0], points[points.length - 1]];
		for (let i = 0; i < ends.length; i++)
			dc.fillEllipse(new Rect(ends[i].x - s / 2, ends[i].y - s / 2, s, s));
	}
	return dc.getImage();
}

/** A stack with a ring behind it, for text or an icon on top. */
function addRing(parent, size, stroke, fraction, hex) {
	const box = parent.addStack();
	box.size = new Size(size, size);
	box.backgroundImage = ringImage(size, stroke, fraction, hex);
	box.centerAlignContent();
	return box;
}

/** A category's icon: in a ring when it has a budget, in a plain circle when it doesn't. */
function addCategoryIcon(parent, c, size) {
	const iconSize = size < 26 ? 11 : 13;
	if (!hasLimit(c)) {
		const chip = addChip(parent, c.sfSymbol, size, CHIP, MUTED);
		return chip;
	}
	const hex = hexFor(statusOf(c.spentCents, c.limitCents));
	const box = addRing(parent, size, size < 26 ? 2.5 : 3, c.spentCents / c.limitCents, hex);
	const image = box.addImage(symbolImage(c.sfSymbol, Font.semiboldSystemFont(iconSize)));
	image.imageSize = new Size(iconSize, iconSize);
	image.tintColor = new Color(hex);
	return box;
}

/** Days left in the month the numbers are for (from `asOf`, e.g. "2026-11-13T…"). */
function daysLeft(asOf) {
	const y = Number(asOf.slice(0, 4));
	const m = Number(asOf.slice(5, 7));
	const day = Number(asOf.slice(8, 10));
	return new Date(y, m, 0).getDate() - day;
}

/** "17 days left · 1:49 PM", or why the numbers are old (common.js's footer, in amber). */
function addBudgetFooter(parent, res) {
	if (res.notice || !isToday(res.data.asOf)) return addFooter(parent, res, false);
	const row = parent.addStack();
	row.centerAlignContent();
	const image = row.addImage(symbolImage('clock'));
	image.imageSize = new Size(9, 9);
	image.tintColor = MUTED;
	row.addSpacer(3);
	const left = daysLeft(res.data.asOf);
	addText(
		row,
		left + (left === 1 ? ' day left · ' : ' days left · ') + whenText(res.data.asOf),
		Font.mediumSystemFont(10),
		MUTED,
		1
	);
	return row;
}

/** Text that's one of the numbers: dimmed with the rest when they're the saved ones. */
function addFigure(parent, value, font, color) {
	const t = addText(parent, value, font, color, 1);
	t.textOpacity = dim;
	return t;
}

function addCentered(parent, value) {
	parent.addSpacer();
	const row = parent.addStack();
	row.addSpacer();
	addText(row, value, Font.systemFont(12), MUTED, 2);
	row.addSpacer();
	parent.addSpacer();
}

/** A thin line across the widget. */
function addDivider(parent, width) {
	const line = parent.addStack();
	line.size = new Size(width, 1);
	line.backgroundColor = CHIP;
}

/** Ring, "spent of budget" and the footer, with all spending at the right. Medium and large. */
function addHero(parent, data, budget, month, large) {
	const ringSize = large ? 76 : 44;
	const hero = parent.addStack();
	hero.centerAlignContent();
	const hasBudgets = budget.limitCents > 0;
	const fraction = hasBudgets ? budget.spentCents / budget.limitCents : 0;
	const hex = hasBudgets ? hexFor(statusOf(budget.spentCents, budget.limitCents)) : NONE_HEX;
	const ring = addRing(hero, ringSize, large ? 8 : 5, fraction, hex);
	addFigure(ring, hasBudgets ? pct(fraction) : '—', Font.semiboldSystemFont(large ? 17 : 12), TEXT);
	hero.addSpacer(12);

	const words = hero.addStack();
	words.layoutVertically();
	// Medium has no title line (room for three rows); the month goes in the budget line.
	if (large) addText(words, 'Budget · ' + month, Font.semiboldSystemFont(11), MUTED, 1);
	if (hasBudgets) {
		addFigure(words, big(budget.spentCents), Font.semiboldSystemFont(large ? 24 : 20), TEXT);
		addFigure(
			words,
			'of ' + big(budget.limitCents) + (large ? ' budget' : ' ' + month + ' budget'),
			Font.systemFont(12),
			MUTED
		);
	} else {
		addText(words, 'No budgets set', Font.semiboldSystemFont(15), TEXT, 1);
		addText(words, 'Settings → Budgets', Font.systemFont(12), MUTED, 1);
	}
	words.addSpacer(2);
	addBudgetFooter(words, result);
	hero.addSpacer();

	// All spending, at the top right: a fixed-height column with a spacer under it.
	const right = hero.addStack();
	right.layoutVertically();
	right.size = new Size(0, ringSize);
	const amount = right.addStack();
	amount.addSpacer();
	addFigure(amount, big(data.net.expenseCents), Font.semiboldSystemFont(13), TEXT);
	const label = right.addStack();
	label.addSpacer();
	addText(label, 'all spending', Font.systemFont(10), MUTED, 1);
	right.addSpacer();
}

/** One category: icon, name (and on large a note under it), "$413 of $400" at the right. */
function addRow(parent, c, large) {
	const row = parent.addStack();
	row.centerAlignContent();
	addCategoryIcon(row, c, large ? 28 : 22);
	row.addSpacer(large ? 10 : 8);
	const size = large ? 13 : 12;
	const words = row.addStack();
	words.layoutVertically();
	addText(words, c.name, Font.mediumSystemFont(size), TEXT, 1);
	if (large) {
		let note = 'No budget';
		let color = MUTED;
		if (hasLimit(c)) {
			const left = c.limitCents - c.spentCents;
			const status = statusOf(c.spentCents, c.limitCents);
			note = left < 0 ? short(-left) + ' over' : left === 0 ? 'All used' : short(left) + ' left';
			color = status === 'over' ? OVER : status === 'close' ? WARN : MUTED;
		}
		addFigure(words, note, Font.systemFont(11), color);
	}
	row.addSpacer(8);
	addFigure(row, short(c.spentCents), Font.semiboldSystemFont(size), TEXT);
	if (hasLimit(c)) addFigure(row, ' of ' + short(c.limitCents), Font.systemFont(size), MUTED);
	else if (!large) addText(row, ' no budget', Font.systemFont(size), MUTED, 1);
}

const widget = new ListWidget();
if (!isAccessory) {
	widget.backgroundColor = BACKGROUND;
	if (isLarge) widget.setPadding(14, 14, 14, 14);
	else widget.setPadding(12, 12, 12, 12);
}

let url = BASE_URL;
if (isAccessory) {
	if (result.problem) drawAccessory(widget, accessoryProblem(result.problem));
	else {
		const data = result.data;
		const month = data.monthLabel.split(' ')[0];
		const budget = data.budget || { limitCents: 0, spentCents: 0 };
		const has = budget.limitCents > 0;
		const share = has ? pct(budget.spentCents / budget.limitCents) : '—';
		drawAccessory(widget, {
			inline: has
				? 'Budget ' + share + ' · ' + short(budget.spentCents) + ' of ' + short(budget.limitCents)
				: 'All spending ' + short(data.net.expenseCents),
			symbol: 'chart.pie',
			circle: share,
			title: 'Budget · ' + month + (result.notice ? ' (old)' : ''),
			lines: has
				? [
						big(budget.spentCents) + ' of ' + big(budget.limitCents),
						'All spending ' + big(data.net.expenseCents)
					]
				: ['No budgets set', 'All spending ' + big(data.net.expenseCents)]
		});
		url = data.url;
	}
} else if (result.problem) {
	url = drawProblem(widget, result.problem, CHIP);
} else {
	const data = result.data;
	const month = data.monthLabel.split(' ')[0];
	// Missing on a server older than the Budget widget: shown as "No budgets set".
	const budget = data.budget || { limitCents: 0, spentCents: 0 };
	const rows = data.topCategories.concat(data.moreCategories || []);

	if (isSmall) {
		const has = budget.limitCents > 0;
		const fraction = has ? budget.spentCents / budget.limitCents : 0;
		const header = widget.addStack();
		addText(header, 'Budget', Font.semiboldSystemFont(12), TEXT, 1);
		addText(header, ' · ' + month, Font.systemFont(12), MUTED, 1);
		widget.addSpacer(8);
		const middle = widget.addStack();
		middle.centerAlignContent();
		const ring = addRing(
			middle,
			60,
			7,
			fraction,
			has ? hexFor(statusOf(budget.spentCents, budget.limitCents)) : NONE_HEX
		);
		addFigure(ring, has ? pct(fraction) : '—', Font.semiboldSystemFont(14), TEXT);
		middle.addSpacer(10);
		const words = middle.addStack();
		words.layoutVertically();
		if (has) {
			addFigure(words, short(budget.spentCents), Font.semiboldSystemFont(17), TEXT);
			addFigure(words, 'of ' + short(budget.limitCents), Font.systemFont(11), MUTED);
		} else addText(words, 'No budgets', Font.semiboldSystemFont(13), TEXT, 1);
		widget.addSpacer();
		const all = widget.addStack();
		addText(all, 'All spending', Font.systemFont(11), MUTED, 1);
		all.addSpacer();
		addFigure(all, short(data.net.expenseCents), Font.semiboldSystemFont(11), TEXT);
		widget.addSpacer(2);
		addBudgetFooter(widget, result);
	} else if (!isLarge) {
		// Medium: the month, then the top three categories by spending.
		addHero(widget, data, budget, month, false);
		if (rows.length === 0) addCentered(widget, 'No spending yet in ' + month);
		else {
			widget.addSpacer();
			const list = widget.addStack();
			list.layoutVertically();
			list.spacing = 4;
			for (let i = 0; i < rows.length && i < 3; i++) addRow(list, rows[i], false);
			if (rows.length === 1) widget.addSpacer();
		}
	} else {
		// Large: the month, then the top five with a note each, then spending with no budget.
		const width = 338 - 28;
		addHero(widget, data, budget, month, true);
		widget.addSpacer(12);
		addDivider(widget, width);
		widget.addSpacer(12);
		const shown = Math.min(rows.length, 5);
		if (shown === 0) addCentered(widget, 'No spending yet in ' + month);
		else {
			for (let i = 0; i < shown; i++) {
				addRow(widget, rows[i], true);
				// Five share the height; fewer sit at the top at the same spacing.
				if (i < shown - 1) {
					if (shown === 5) widget.addSpacer();
					else widget.addSpacer(12);
				}
			}
			widget.addSpacer();
		}
		widget.addSpacer(10);
		addDivider(widget, width);
		widget.addSpacer(8);
		const foot = widget.addStack();
		addText(foot, 'Not budgeted', Font.systemFont(11), MUTED, 1);
		foot.addSpacer();
		addFigure(
			foot,
			short(data.net.expenseCents - budget.spentCents),
			Font.semiboldSystemFont(11),
			TEXT
		);
	}
	url = data.url;
}

await finish(widget, url);
