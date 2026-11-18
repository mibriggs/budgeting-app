import { error, fail, redirect } from '@sveltejs/kit';
import { today } from '#lib/dates.ts';
import { resolveRange } from '#lib/date-range.ts';
import { isActiveCategory, listActiveCategories } from '#lib/server/budget/categories.ts';
import { isActivePaymentMethod, listPaymentMethods } from '#lib/server/budget/payment-methods.ts';
import { generateDueCharges } from '#lib/server/budget/recurring.ts';
import { displayName } from '#lib/server/user.ts';
import {
	createTransaction,
	deleteTransactions,
	listExpenses,
	listIncome,
	MAX_DELETE,
	transactionRefs,
	updateTransaction,
	type TransactionKind
} from '#lib/server/budget/transactions.ts';
import {
	MAX_NAME_LENGTH,
	MAX_NOTES_LENGTH,
	parseAmount,
	parseDate
} from '#lib/transaction-input.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		return redirect(302, '/login');
	}

	const userId = locals.user.id;
	const todayForUser = today(locals.user.timezone ?? undefined);
	const range = resolveRange(url.searchParams, todayForUser);
	// Add any recurring charges that came due (e.g. rent on the 1st) before reading expenses.
	await generateDueCharges(userId, todayForUser);

	const [expenses, incomes, expenseCategories, incomeCategories, paymentMethods] =
		await Promise.all([
			listExpenses(userId, range),
			listIncome(userId, range),
			listActiveCategories(userId, 'expense'),
			listActiveCategories(userId, 'income'),
			listPaymentMethods(userId)
		]);

	return {
		displayName: displayName(locals.user),
		range,
		today: todayForUser,
		expenses,
		incomes,
		categories: { expense: expenseCategories, income: incomeCategories },
		paymentMethods: paymentMethods.map(({ id, kind, name, last4, closingDay }) => ({
			id,
			kind,
			name,
			last4,
			closingDay
		}))
	};
};

const isKind = (value: unknown): value is TransactionKind =>
	value === 'expense' || value === 'income';

export type CreateField = 'name' | 'amount' | 'date' | 'categoryId' | 'notes' | 'paymentMethodId';

/**
 * Reads and checks the add/edit form. `keep` is what the entry being edited has now: it may keep
 * a category that's since been archived, or a payment method that's since been removed, but not
 * switch to one. Returns the clean values, or per-field errors.
 */
async function readEntry(
	form: FormData,
	userId: string,
	kind: TransactionKind,
	keep?: { categoryId: string; paymentMethodId: string | null }
) {
	const field = (key: string) => {
		const value = form.get(key);
		return typeof value === 'string' ? value : '';
	};
	const values = {
		name: field('name').trim(),
		amount: field('amount').trim(),
		date: field('date').trim(),
		categoryId: field('categoryId').trim(),
		notes: field('notes').trim(),
		// Expenses only; empty means "not recorded".
		paymentMethodId: kind === 'expense' ? field('paymentMethodId').trim() : ''
	};
	const errors: Partial<Record<CreateField, string>> = {};

	if (!values.name) errors.name = 'Enter a name.';
	else if (values.name.length > MAX_NAME_LENGTH)
		errors.name = `Keep it under ${MAX_NAME_LENGTH} characters.`;

	const amountCents = parseAmount(values.amount);
	if (amountCents === null)
		errors.amount = values.amount ? 'Enter an amount above $0, like 12.50.' : 'Enter an amount.';

	const date = parseDate(values.date);
	if (!date) errors.date = 'Pick a date.';

	if (!values.categoryId) errors.categoryId = 'Pick a category.';
	else if (
		values.categoryId !== keep?.categoryId &&
		!(await isActiveCategory(userId, kind, values.categoryId))
	)
		errors.categoryId = 'That category is no longer available. Pick another.';

	if (values.notes.length > MAX_NOTES_LENGTH)
		errors.notes = `Keep notes under ${MAX_NOTES_LENGTH} characters.`;

	if (
		values.paymentMethodId &&
		values.paymentMethodId !== keep?.paymentMethodId &&
		!(await isActivePaymentMethod(userId, values.paymentMethodId))
	)
		errors.paymentMethodId = 'That payment method was removed. Pick another.';

	if (Object.keys(errors).length > 0 || amountCents === null || !date)
		return { ok: false, errors, values } as const;
	return {
		ok: true,
		values,
		entry: {
			name: values.name,
			date,
			amountCents,
			categoryId: values.categoryId,
			notes: values.notes || null,
			paymentMethodId: values.paymentMethodId || null
		}
	} as const;
}

export const actions: Actions = {
	/** Adds one expense or income row from the add form. Returns per-field errors on bad input. */
	create: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');

		const form = await request.formData();
		const kind = form.get('kind');
		if (!isKind(kind)) return fail(400, { errors: { name: 'Unknown transaction type.' } });

		const result = await readEntry(form, locals.user.id, kind);
		if (!result.ok) return fail(400, { kind, errors: result.errors, values: result.values });

		const id = await createTransaction(locals.user.id, kind, result.entry);
		return { created: id, kind, name: result.values.name, date: result.values.date };
	},

	/** Changes one of the user's expense or income rows (`kind` and `id` say which). */
	update: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');

		const form = await request.formData();
		const kind = form.get('kind');
		const id = form.get('id');
		if (!isKind(kind) || typeof id !== 'string' || !id)
			return fail(400, { errors: { name: 'Unknown entry.' } });

		const keep = await transactionRefs(locals.user.id, kind, id);
		if (!keep) return fail(404, { errors: { name: 'That entry was deleted.' } });

		const result = await readEntry(form, locals.user.id, kind, keep);
		if (!result.ok) return fail(400, { kind, errors: result.errors, values: result.values });

		if (!(await updateTransaction(locals.user.id, kind, id, result.entry)))
			return fail(404, { errors: { name: 'That entry was deleted.' } });
		return { updated: id, kind, name: result.values.name, date: result.values.date };
	},

	/** Deletes the expenses or income rows whose IDs are posted as repeated `id` fields. */
	delete: async ({ locals, request }) => {
		if (!locals.user) error(401, 'Not signed in');

		const form = await request.formData();
		const kind = form.get('kind');
		const ids = [...new Set(form.getAll('id').filter((id) => typeof id === 'string'))];

		if (!isKind(kind)) {
			return fail(400, { error: 'Unknown transaction type.' });
		}
		if (ids.length === 0) {
			return fail(400, { error: 'Nothing was selected.' });
		}
		if (ids.length > MAX_DELETE) {
			return fail(400, { error: `You can delete up to ${MAX_DELETE} rows at once.` });
		}

		const deleted = await deleteTransactions(locals.user.id, kind, ids);
		return { deleted: deleted.length, kind };
	}
};
