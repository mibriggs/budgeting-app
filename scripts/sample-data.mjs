// Fills the database with fake income and expenses for every user, for trying out the UI.
//
//   npm run db:sample          add ~14 months of sample data (replaces earlier sample data)
//   npm run db:sample:clear    remove all sample data
//
// Sample rows have IDs starting with "sample-", so they never mix with real data.
// Uses a fixed random seed, so the data is the same every run (dates move with today).

import { createClient } from '@libsql/client';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const client = createClient({ url });

await client.batch([
	"DELETE FROM expense WHERE id LIKE 'sample-%'",
	"DELETE FROM income WHERE id LIKE 'sample-%'"
]);

if (process.argv.includes('--clear')) {
	console.log('Removed sample data.');
	process.exit(0);
}

// Small seeded random number generator (mulberry32).
let seed = 20261110;
function random() {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (items) => items[Math.floor(random() * items.length)];
const cents = (min, max) => Math.round((min + random() * (max - min)) * 100);

// [category, [names], [min $, max $], times per month]
const SPENDING = [
	['Groceries', ['Trader Joe’s', 'Whole Foods', 'Costco', 'Corner market'], [15, 180], 8],
	[
		'Entertainment & Eating Out',
		['Chipotle', 'Sushi place', 'Movie tickets', 'Bar tab'],
		[12, 90],
		6
	],
	['Transportation', ['Gas', 'Uber', 'Parking', 'Train pass'], [4, 70], 5],
	['Snacks & Candy', ['Gas station snacks', 'Candy', 'Coffee'], [2, 15], 6],
	['Personal & Misc.', ['Haircut', 'Target run', 'Amazon order'], [10, 120], 3],
	['Wellness', ['Protein powder', 'BJJ drop-in', 'Vitamins'], [20, 80], 2],
	['Pet', ['Dog food', 'Vet visit', 'Treats'], [10, 150], 2],
	['Laundry', ['Laundromat', 'Detergent'], [5, 25], 2],
	['Date Night', ['Dinner out', 'Concert', 'Mini golf'], [40, 160], 1],
	['Medical & Health', ['Pharmacy', 'Copay'], [10, 60], 1],
	['Technology', ['USB-C cable', 'App purchase', 'Keyboard'], [5, 150], 1],
	['Gifts', ['Birthday gift', 'Flowers'], [20, 100], 0.5],
	['Education', ['Online course', 'Books'], [15, 200], 0.5]
];
// [category, name, day of month, $ amount]
const MONTHLY = [
	['Rent', 'Rent', 1, 1850],
	['Utilities', 'Electric', 12, null],
	['Utilities', 'Internet', 18, 65],
	['Subscriptions', 'Spotify', 3, 11.99],
	['Subscriptions', 'Netflix', 9, 15.49],
	['Wellness', 'Gym membership', 5, 45],
	['Savings', 'Transfer to savings', 2, 500],
	['Housing', 'Renters insurance', 20, 18]
];

const today = new Date();
const todayIso = iso(today.getFullYear(), today.getMonth() + 1, today.getDate());
function iso(year, month, day) {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function daysIn(year, month) {
	return new Date(year, month, 0).getDate();
}

const users = (await client.execute('SELECT id FROM user')).rows;
let n = 0;

for (const { id: userId } of users) {
	const categoryIds = async (table) =>
		Object.fromEntries(
			(
				await client.execute({
					sql: `SELECT id, name FROM ${table} WHERE user_id = ?`,
					args: [userId]
				})
			).rows.map((row) => [row.name, row.id])
		);
	const expenseCategories = await categoryIds('expense_category');
	const incomeCategories = await categoryIds('income_category');
	const statements = [];

	const addExpense = (category, name, date, amountCents, notes = null) => {
		const categoryId = expenseCategories[category];
		if (!categoryId || date > todayIso) return;
		statements.push({
			sql: 'INSERT INTO expense (id, user_id, category_id, name, purchase_date, amount_cents, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
			args: [`sample-${n++}`, userId, categoryId, name, date, amountCents, notes]
		});
	};
	const addIncome = (category, name, date, amountCents, notes = null) => {
		const categoryId = incomeCategories[category];
		if (!categoryId || date > todayIso) return;
		statements.push({
			sql: 'INSERT INTO income (id, user_id, category_id, name, received_date, amount_cents, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
			args: [`sample-${n++}`, userId, categoryId, name, date, amountCents, notes]
		});
	};

	// 14 months: this month and the 13 before it.
	for (let back = 13; back >= 0; back--) {
		const d = new Date(today.getFullYear(), today.getMonth() - back, 1);
		const year = d.getFullYear();
		const month = d.getMonth() + 1;
		const days = daysIn(year, month);

		for (const [category, name, day, amount] of MONTHLY) {
			const value = amount === null ? cents(40, 140) : Math.round(amount * 100);
			addExpense(category, name, iso(year, month, Math.min(day, days)), value);
		}
		for (const [category, names, [min, max], perMonth] of SPENDING) {
			const count = Math.floor(perMonth) + (random() < perMonth % 1 ? 1 : 0);
			for (let i = 0; i < count; i++) {
				const notes =
					random() < 0.15 ? pick(['Split with friend', 'Used coupon', 'Paid cash']) : null;
				addExpense(
					category,
					pick(names),
					iso(year, month, 1 + Math.floor(random() * days)),
					cents(min, max),
					notes
				);
			}
		}

		addIncome('Salary', 'Paycheck', iso(year, month, 1), 310000);
		addIncome('Salary', 'Paycheck', iso(year, month, 15), 310000);
		if (random() < 0.6) {
			addIncome(
				'Freelance',
				pick(['Website project', 'Consulting', 'Logo design']),
				iso(year, month, 1 + Math.floor(random() * days)),
				cents(200, 1500),
				'Invoice paid'
			);
		}
	}

	await client.batch(statements, 'write');
}

const [expenses, incomes] = await Promise.all([
	client.execute("SELECT count(*) AS n FROM expense WHERE id LIKE 'sample-%'"),
	client.execute("SELECT count(*) AS n FROM income WHERE id LIKE 'sample-%'")
]);
console.log(
	`Added ${expenses.rows[0].n} sample expenses and ${incomes.rows[0].n} sample income rows for ${users.length} user(s).`
);
