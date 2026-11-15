// Credit card due-date reminders, sent by the scheduled tick (tick.ts): the day before and the
// day of each card's payment due date, at the card's reminder time in the user's time zone.
// Same rules as recurring reminders: claimed in `card_reminder_sent` before sending, so each
// goes out once; a reminder whose time has passed today is still sent by a later tick.
//
// Wording (future-plans, "Payment methods"):
//   Credit card payment tomorrow / Credit card payment due today
//   Chase Sapphire ••4821 — $500.00 recorded on this statement.
//   Chase Sapphire ••4821 — payment due tomorrow. No spending recorded on this statement.
//   Chase Sapphire ••4821 — payment due tomorrow.   (no closing date, so no statement total)
// "Recorded" because only expenses marked "Paid with" the card count, not the bank's balance.

import { and, between, eq, isNotNull, isNull, sum } from 'drizzle-orm';
import { Temporal, type PlainDate } from '#lib/dates.ts';
import { formatCents } from '#lib/money.ts';
import { cardCycle, nextOnDay } from '#lib/payment-methods.ts';
import { db } from '#lib/server/db/index.ts';
import { cardReminderSent, expense, paymentMethod, user } from '#lib/server/db/schema.ts';
import type { PushPayload } from '#lib/server/push.ts';

type Kind = 'day-before' | 'day-of';

/**
 * Claims the card reminders due right now and returns their messages (not sent yet).
 * `nowFor` gives "now" in a time zone, shared with the recurring reminders.
 */
export async function cardReminderMessages(
	nowFor: (timezone: string | null) => Temporal.ZonedDateTime
): Promise<{ userId: string; payload: PushPayload }[]> {
	// Every credit card with a due date (removed ones left out), with its owner's settings.
	const cards = await db
		.select({
			id: paymentMethod.id,
			userId: paymentMethod.userId,
			name: paymentMethod.name,
			last4: paymentMethod.last4,
			closingDay: paymentMethod.closingDay,
			dueDay: paymentMethod.dueDay,
			remindAtMinutes: paymentMethod.remindAtMinutes,
			timezone: user.timezone,
			showCreditCards: user.showCreditCards
		})
		.from(paymentMethod)
		.innerJoin(user, eq(user.id, paymentMethod.userId))
		.where(
			and(
				eq(paymentMethod.kind, 'credit'),
				isNotNull(paymentMethod.dueDay),
				isNull(paymentMethod.archivedAt)
			)
		);

	// Reminders whose time has come today: due tomorrow (day before) or today (day of).
	const due: { card: (typeof cards)[number]; kind: Kind; date: PlainDate; today: PlainDate }[] = [];
	for (const card of cards) {
		const local = nowFor(card.timezone);
		if (local.hour * 60 + local.minute < card.remindAtMinutes) continue;
		const today = local.toPlainDate();
		const tomorrow = today.add({ days: 1 });
		const dueDay = card.dueDay!;
		if (nextOnDay(tomorrow, dueDay).equals(tomorrow))
			due.push({ card, kind: 'day-before', date: tomorrow, today });
		if (nextOnDay(today, dueDay).equals(today))
			due.push({ card, kind: 'day-of', date: today, today });
	}
	if (due.length === 0) return [];

	// Claim them in one insert; keep only the ones this call claimed.
	const claimed = await db
		.insert(cardReminderSent)
		.values(due.map((d) => ({ paymentMethodId: d.card.id, dueDate: d.date, kind: d.kind })))
		.onConflictDoNothing()
		.returning({
			paymentMethodId: cardReminderSent.paymentMethodId,
			dueDate: cardReminderSent.dueDate,
			kind: cardReminderSent.kind
		});
	const key = (id: string, date: PlainDate, kind: string) => `${id}|${date}|${kind}`;
	const mine = new Set(claimed.map((c) => key(c.paymentMethodId, c.dueDate, c.kind)));
	const toSend = due.filter((d) => mine.has(key(d.card.id, d.date, d.kind)));

	return Promise.all(
		toSend.map(async ({ card, kind, date, today }) => ({
			userId: card.userId,
			payload: cardPayload(card, kind, date, await statementTotal(card, date, today))
		}))
	);
}

/**
 * The recorded total of the statement due on `date`, or null when it can't be worked out (no
 * closing date, or the dates don't line up with a statement due then).
 */
async function statementTotal(
	card: { id: string; closingDay: number | null; dueDay: number | null },
	date: PlainDate,
	today: PlainDate
): Promise<number | null> {
	if (!card.closingDay) return null;
	const { statement } = cardCycle(today, card.closingDay, card.dueDay);
	if (!statement.dueOn?.equals(date)) return null;
	const [row] = await db
		.select({ cents: sum(expense.amountCents).mapWith(Number) })
		.from(expense)
		.where(
			and(
				eq(expense.paymentMethodId, card.id),
				between(expense.purchaseDate, statement.from, statement.to)
			)
		);
	return row?.cents ?? 0;
}

function cardPayload(
	card: { id: string; name: string; last4: string | null; showCreditCards: boolean },
	kind: Kind,
	date: PlainDate,
	totalCents: number | null
): PushPayload {
	const label = card.last4 ? `${card.name} ••${card.last4}` : card.name;
	const when = kind === 'day-before' ? 'tomorrow' : 'today';
	const body =
		totalCents === null
			? `${label} — payment due ${when}.`
			: totalCents === 0
				? `${label} — payment due ${when}. No spending recorded on this statement.`
				: `${label} — ${formatCents(totalCents)} recorded on this statement.`;
	return {
		title: kind === 'day-before' ? 'Credit card payment tomorrow' : 'Credit card payment due today',
		body,
		// Where the card's numbers are: the home page card, unless it's hidden there.
		url: card.showCreditCards ? '/' : '/settings/payment-methods',
		// Same tag for both reminders of one due date, so the day-of one replaces the day-before.
		tag: `card-${card.id}-${date}`
	};
}
