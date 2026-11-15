// ─── Top spending widget ───
// This month's biggest spending categories: 3, or up to 7 on the large widget. Medium and
// large show, per category, its share of the month's spending (or with SHOW = 'budget', how
// much of its budget is used, red when over) as a bar, or as a second line with LAYOUT = 'list';
// the month's total is in the header. Small shows name and amount;
// the Lock Screen sizes show the same as text.
// Not a module: joined after common.js (see that file).

// Settings from the header (SHOW, LAYOUT); scripts pasted before they existed get the defaults.
const SHOW_BUDGET = typeof SHOW !== 'undefined' && SHOW === 'budget';
const AS_LIST = typeof LAYOUT !== 'undefined' && LAYOUT === 'list';

// "$48" under $1,000 (budgets are a rough guide), compact above.
function roughMoney(cents) {
	return Math.abs(cents) < 100000 ? '$' + Math.round(Math.abs(cents) / 100) : money(cents);
}
function hasBudget(c) {
	return c.limitCents !== null && c.limitCents !== undefined && c.limitCents > 0;
}
/** The bar under a category: its share of spending, or how much of its budget is used. */
function barFor(c) {
	if (!SHOW_BUDGET)
		return {
			fill: c.shareOfSpending,
			over: false,
			label: Math.round(c.shareOfSpending * 100) + '%'
		};
	if (!hasBudget(c)) return { fill: 0, over: false, label: 'No budget' };
	const used = c.spentCents / c.limitCents;
	return { fill: Math.min(used, 1), over: used > 1, label: Math.round(used * 100) + '% used' };
}
/** The list layout's second line: "58% of spending", or "$48 left of $400" / "$12 over $400". */
function secondLine(c) {
	if (!SHOW_BUDGET) return Math.round(c.shareOfSpending * 100) + '% of spending';
	if (!hasBudget(c)) return 'No budget';
	const left = c.limitCents - c.spentCents;
	return left >= 0
		? roughMoney(left) + ' left of ' + roughMoney(c.limitCents)
		: roughMoney(-left) + ' over ' + roughMoney(c.limitCents);
}

const result = await load();
const BACKGROUND = dyn('#eef2ff', '#181b30');
const CHIP = dyn('#dfe5fb', '#262a45');
const BAR = new Color('#3b82f6');
// Saved numbers are dimmed: still readable, visibly not current.
const dim = result.notice ? 0.6 : 1;

const widget = new ListWidget();
if (!isAccessory) {
	widget.backgroundColor = BACKGROUND;
	widget.setPadding(isSmall ? 12 : 14, 14, isSmall ? 12 : 14, 14);
}

let url = BASE_URL;
if (isAccessory) {
	if (result.problem) drawAccessory(widget, accessoryProblem(result.problem));
	else {
		const data = result.data;
		const month = data.monthLabel.split(' ')[0];
		const rows = data.topCategories;
		const first = rows[0];
		const lines = [];
		for (let i = 0; i < rows.length; i++)
			lines.push(rows[i].name + ' ' + money(rows[i].spentCents));
		drawAccessory(widget, {
			inline: first ? 'Top: ' + first.name + ' ' + money(first.spentCents) : 'No spending yet',
			symbol: first ? first.sfSymbol : 'cart',
			circle: money(data.net.expenseCents),
			title: 'Top spending · ' + money(data.net.expenseCents) + (result.notice ? ' (old)' : ''),
			lines: lines.length > 0 ? lines : ['No spending yet in ' + month]
		});
		url = data.url;
	}
} else if (result.problem) {
	url = drawProblem(widget, result.problem, CHIP);
} else {
	const data = result.data;
	const month = data.monthLabel.split(' ')[0];
	// Large adds ranks 4–7 (sent separately so older scripts keep showing 3).
	const rows = isLarge ? data.topCategories.concat(data.moreCategories || []) : data.topCategories;
	const full = isLarge ? 7 : 3;

	const header = widget.addStack();
	header.centerAlignContent();
	addText(header, 'Top spending', Font.semiboldSystemFont(isSmall ? 12 : 13), TEXT, 1);
	// Short month ("Nov") so the header fits beside the total and time.
	addText(header, ' · ' + month.slice(0, 3), Font.systemFont(isSmall ? 12 : 13), MUTED, 1);
	if (!isSmall) {
		// The total the percentages are shares of, then when it was updated.
		header.addSpacer();
		addText(
			header,
			money(data.net.expenseCents),
			Font.semiboldSystemFont(12),
			TEXT,
			1
		).textOpacity = dim;
		addText(header, ' spent', Font.systemFont(12), MUTED, 1);
		header.addSpacer(8);
		addFooter(header, result, true);
	}
	widget.addSpacer(isSmall ? 6 : 8);

	if (rows.length === 0) {
		widget.addSpacer();
		const empty = widget.addStack();
		empty.addSpacer();
		addText(
			empty,
			isSmall ? 'No spending yet' : 'No spending yet in ' + month,
			Font.systemFont(12),
			MUTED,
			2
		);
		empty.addSpacer();
		widget.addSpacer();
	} else {
		for (let i = 0; i < rows.length; i++) {
			const c = rows[i];
			const row = widget.addStack();
			row.centerAlignContent();
			addChip(row, c.sfSymbol, isSmall ? 20 : 28, CHIP, TEXT);
			row.addSpacer(isSmall ? 6 : 10);
			const col = row.addStack();
			col.layoutVertically();
			if (isSmall) {
				addText(col, c.name, Font.mediumSystemFont(11), TEXT, 1);
				addText(col, money(c.spentCents), Font.semiboldSystemFont(11), TEXT, 1).textOpacity = dim;
			} else {
				const b = barFor(c);
				if (AS_LIST) {
					// Name over the share or budget line, amount on the right.
					const line = col.addStack();
					line.centerAlignContent();
					const words = line.addStack();
					words.layoutVertically();
					addText(words, c.name, Font.mediumSystemFont(13), TEXT, 1);
					addText(words, secondLine(c), Font.systemFont(11), b.over ? DOWN : MUTED, 1).textOpacity =
						dim;
					line.addSpacer();
					addText(line, money(c.spentCents), Font.semiboldSystemFont(13), TEXT, 1).textOpacity =
						dim;
				} else {
					const first = col.addStack();
					addText(first, c.name, Font.mediumSystemFont(13), TEXT, 1);
					first.addSpacer();
					addText(first, money(c.spentCents), Font.semiboldSystemFont(13), TEXT, 1).textOpacity =
						dim;
					col.addSpacer(4);
					const second = col.addStack();
					second.centerAlignContent();
					addBar(second, 190, b.fill, b.over ? DOWN : BAR, CHIP);
					second.addSpacer();
					addText(second, b.label, Font.systemFont(10), b.over ? DOWN : MUTED, 1).textOpacity = dim;
				}
			}
			// A full set of rows shares the height evenly; fewer sit at the top.
			if (i < rows.length - 1) {
				if (rows.length === full) widget.addSpacer();
				else widget.addSpacer(isSmall ? 6 : 10);
			}
		}
		widget.addSpacer();
	}
	if (isSmall) addFooter(widget, result, false);
	url = data.url;
}

await finish(widget, url);
