// ─── Net cash flow widget ───
// Up arrow (green) when you earned more than you spent this month, down (red) when you spent
// more; the amount is shown without a sign. Medium adds Earned and Spent bars.
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
widget.backgroundColor = BACKGROUNDS[result.problem ? 'flat' : direction];
widget.setPadding(14, 14, 14, 14);

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

let url = BASE_URL;
if (result.problem) {
	url = drawProblem(widget, result.problem, CHIP);
} else if (isSmall) {
	const top = widget.addStack();
	addArrow(top);
	top.addSpacer();
	const label = addText(top, 'Net cash\nflow', Font.semiboldSystemFont(12), TEXT, 2);
	label.rightAlignText();
	widget.addSpacer();
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
	url = result.data.url;
}

await finish(widget, url);
