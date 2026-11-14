// ─── Top spending widget ───
// This month's 3 biggest spending categories. Medium shows each one's share of the month's
// spending as a bar; small shows name and amount.
// Not a module: joined after common.js (see that file).

const result = await load();
const BACKGROUND = dyn('#eef2ff', '#181b30');
const CHIP = dyn('#dfe5fb', '#262a45');
const BAR = new Color('#3b82f6');
// Saved numbers are dimmed: still readable, visibly not current.
const dim = result.notice ? 0.6 : 1;

const widget = new ListWidget();
widget.backgroundColor = BACKGROUND;
widget.setPadding(isSmall ? 12 : 14, 14, isSmall ? 12 : 14, 14);

let url = BASE_URL;
if (result.problem) {
	url = drawProblem(widget, result.problem, CHIP);
} else {
	const data = result.data;
	const month = data.monthLabel.split(' ')[0];
	const rows = data.topCategories;

	const header = widget.addStack();
	header.centerAlignContent();
	addText(header, 'Top spending', Font.semiboldSystemFont(isSmall ? 12 : 13), TEXT, 1);
	addText(header, ' · ' + month, Font.systemFont(isSmall ? 12 : 13), MUTED, 1);
	if (!isSmall) {
		header.addSpacer();
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
				const first = col.addStack();
				addText(first, c.name, Font.mediumSystemFont(13), TEXT, 1);
				first.addSpacer();
				addText(first, money(c.spentCents), Font.semiboldSystemFont(13), TEXT, 1).textOpacity = dim;
				col.addSpacer(4);
				const second = col.addStack();
				second.centerAlignContent();
				addBar(second, 190, c.shareOfSpending, BAR, CHIP);
				second.addSpacer();
				addText(
					second,
					Math.round(c.shareOfSpending * 100) + '%',
					Font.systemFont(10),
					MUTED,
					1
				).textOpacity = dim;
			}
			// Three rows share the height evenly; fewer sit at the top.
			if (i < rows.length - 1) {
				if (rows.length === 3) widget.addSpacer();
				else widget.addSpacer(isSmall ? 6 : 10);
			}
		}
		widget.addSpacer();
	}
	if (isSmall) addFooter(widget, result, false);
	url = data.url;
}

await finish(widget, url);
