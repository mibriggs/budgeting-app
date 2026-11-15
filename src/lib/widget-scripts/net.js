// ─── Net cash flow widget ───
// Up arrow (green) when you earned more than you spent this month, down (red) when you spent
// more; the amount is shown without a sign. Medium adds Earned and Spent bars; large adds a
// chart of the last 6 months below that; the Lock Screen sizes show the numbers as text.
// Not a module: joined after common.js (see that file).

const result = await load();
const net = result.data ? result.data.net : null;
const direction = !net || net.netCents === 0 ? 'flat' : net.netCents > 0 ? 'up' : 'down';
const BACKGROUNDS = {
	up: dyn('#ecfdf3', '#12261b'),
	down: dyn('#fef2f2', '#2b1515'),
	flat: dyn('#ffffff', '#1c1c1e')
};
const CHIP = dyn('#f3f4f6', '#2c2c2e');
// Saved numbers are dimmed: still readable, visibly not current.
const dim = result.notice ? 0.6 : 1;

const widget = new ListWidget();
if (!isAccessory) {
	widget.backgroundColor = BACKGROUNDS[result.problem ? 'flat' : direction];
	widget.setPadding(14, 14, 14, 14);
}

function addArrow(parent) {
	const name = direction === 'up' ? 'arrow.up' : direction === 'down' ? 'arrow.down' : 'minus';
	const accent = direction === 'up' ? UP : direction === 'down' ? DOWN : MUTED;
	return addChip(parent, name, 36, accent, WHITE);
}

function addAmount(parent, size) {
	const t = addText(parent, money(net.netCents), Font.boldSystemFont(size), TEXT, 1);
	t.minimumScaleFactor = 0.5;
	t.textOpacity = dim;
	return t;
}

/**
 * Large only: the last 6 months, earned (green) beside spent (red), this month last and in
 * bold, with each month's net under it.
 */
function addMonths(parent, months) {
	parent.addSpacer(12);
	const rule = parent.addStack();
	rule.size = new Size(0, 1);
	rule.backgroundColor = CHIP;
	parent.addSpacer(8);

	const head = parent.addStack();
	head.centerAlignContent();
	addText(head, 'Last 6 months', Font.semiboldSystemFont(12), TEXT, 1);
	head.addSpacer();
	const legend = [
		['Earned', UP],
		['Spent', DOWN]
	];
	for (let i = 0; i < legend.length; i++) {
		const dot = head.addStack();
		dot.size = new Size(6, 6);
		dot.cornerRadius = 3;
		dot.backgroundColor = legend[i][1];
		head.addSpacer(3);
		addText(head, legend[i][0], Font.systemFont(10), MUTED, 1);
		if (i === 0) head.addSpacer(8);
	}
	parent.addSpacer(6);

	const CHART = 90;
	let most = 1;
	for (let i = 0; i < months.length; i++)
		most = Math.max(most, months[i].incomeCents, months[i].expenseCents);
	const height = function (cents) {
		return cents > 0 ? Math.max(2, Math.round((cents / most) * CHART)) : 0;
	};

	const chart = parent.addStack();
	for (let i = 0; i < months.length; i++) {
		const m = months[i];
		const isNow = i === months.length - 1;
		const col = chart.addStack();
		col.layoutVertically();
		const bars = col.addStack();
		bars.size = new Size(40, CHART);
		bars.bottomAlignContent();
		bars.addSpacer();
		const pair = [
			[m.incomeCents, UP],
			[m.expenseCents, DOWN]
		];
		for (let j = 0; j < pair.length; j++) {
			const b = bars.addStack();
			b.size = new Size(10, height(pair[j][0]));
			b.cornerRadius = 2;
			b.backgroundColor = pair[j][1];
			if (j === 0) bars.addSpacer(2);
		}
		bars.addSpacer();
		col.addSpacer(3);
		const labelRow = col.addStack();
		labelRow.size = new Size(40, 0);
		labelRow.addSpacer();
		addText(
			labelRow,
			m.label,
			isNow ? Font.semiboldSystemFont(10) : Font.systemFont(10),
			isNow ? TEXT : MUTED,
			1
		);
		labelRow.addSpacer();
		const netRow = col.addStack();
		netRow.size = new Size(40, 0);
		netRow.addSpacer();
		const diff = m.incomeCents - m.expenseCents;
		const t = addText(
			netRow,
			(diff >= 0 ? '+' : '−') + money(diff),
			Font.systemFont(9),
			diff >= 0 ? UP : DOWN,
			1
		);
		t.minimumScaleFactor = 0.6;
		t.textOpacity = dim;
		netRow.addSpacer();
		if (i < months.length - 1) chart.addSpacer();
	}
}

let url = BASE_URL;
if (isAccessory) {
	if (result.problem) drawAccessory(widget, accessoryProblem(result.problem));
	else {
		const arrow = direction === 'up' ? '↑ ' : direction === 'down' ? '↓ ' : '';
		const month = result.data.monthLabel.split(' ')[0];
		drawAccessory(widget, {
			inline: arrow + money(net.netCents) + ' net · ' + month,
			symbol: direction === 'up' ? 'arrow.up' : direction === 'down' ? 'arrow.down' : 'minus',
			circle: money(net.netCents),
			title: 'Net cash flow · ' + month + (result.notice ? ' (old)' : ''),
			lines: [
				arrow + money(net.netCents),
				'Earned ' + money(net.incomeCents) + ' · Spent ' + money(net.expenseCents)
			]
		});
		url = result.data.url;
	}
} else if (result.problem) {
	url = drawProblem(widget, result.problem, CHIP);
} else if (isSmall) {
	// Arrow on its own row; the title gets the full width below it (beside the arrow, Scriptable
	// cut it off as "Net cash…" instead of wrapping it).
	addArrow(widget);
	widget.addSpacer();
	const title = addText(widget, 'Net cash flow', Font.semiboldSystemFont(12), TEXT, 1);
	title.minimumScaleFactor = 0.8;
	addAmount(widget, 34);
	widget.addSpacer(2);
	addText(widget, result.data.monthLabel, Font.systemFont(12), MUTED, 1);
	widget.addSpacer(4);
	addFooter(widget, result, false);
	url = result.data.url;
} else {
	const row = widget.addStack();
	const left = row.addStack();
	left.layoutVertically();
	left.size = new Size(130, 0);
	addArrow(left);
	left.addSpacer();
	addText(left, 'Net cash flow', Font.semiboldSystemFont(12), TEXT, 1);
	addAmount(left, 30);
	left.addSpacer(2);
	addText(left, result.data.monthLabel, Font.systemFont(12), MUTED, 1);

	row.addSpacer(16);
	const right = row.addStack();
	right.layoutVertically();
	right.addSpacer();
	const most = Math.max(net.incomeCents, net.expenseCents, 1);
	const lines = [
		['Earned', net.incomeCents, UP],
		['Spent', net.expenseCents, DOWN]
	];
	for (let i = 0; i < lines.length; i++) {
		const line = right.addStack();
		addText(line, lines[i][0], Font.systemFont(12), MUTED, 1);
		line.addSpacer();
		addText(line, money(lines[i][1]), Font.semiboldSystemFont(12), TEXT, 1).textOpacity = dim;
		right.addSpacer(4);
		addBar(right, 156, lines[i][1] / most, lines[i][2], CHIP);
		right.addSpacer(10);
	}
	right.addSpacer();
	const foot = right.addStack();
	foot.addSpacer();
	addFooter(foot, result, false);
	if (isLarge && result.data.months && result.data.months.length > 0)
		addMonths(widget, result.data.months);
	url = result.data.url;
}

await finish(widget, url);
