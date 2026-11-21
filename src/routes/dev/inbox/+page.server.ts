// Dev-only mock of the quick-add inbox: paste a bank alert or type a shorthand like
// "5.06 apple card snacks", review what CentJar read, and add it with one tap on a category.
// Sample data only: no database, no sign-in, nothing is saved. 404 outside `npm run dev`.

import { error } from '@sveltejs/kit';
import { dev } from '$app/env';
import type { PaymentMethodKind } from '#lib/payment-methods.ts';
import { Temporal } from '#lib/dates.ts';
import type { PageServerLoad } from './$types';
import { mockHome } from './mock-home';

export type MockCategory = {
	id: string;
	name: string;
	/** Lucide key from src/lib/category-icons.ts. */
	icon: string;
	/** Words in a typed shorthand that suggest this category ("lunch" → Eating Out). */
	keywords: string[];
};

export type MockPaymentMethod = {
	id: string;
	kind: PaymentMethodKind;
	name: string;
	last4: string | null;
	/** Text that names this method in a bank alert or a shorthand, matched case-insensitively.
	 *  Not in the schema yet: the real version needs an alias column or table. */
	aliases: string[];
};

/** Bank merchant text → a readable name and a category. The "learning" table: confirming an
 *  item would add or update a rule. Not in the schema yet. */
export type MerchantRule = { match: string; name: string; categoryId: string };

/** An expense already in CentJar, for the possible-duplicate check. */
export type MockExpense = {
	id: string;
	name: string;
	amountCents: number;
	date: string;
	paymentMethodId: string | null;
	categoryId: string;
	recurring: boolean;
};

const categories: MockCategory[] = [
	{
		id: 'groceries',
		name: 'Groceries',
		icon: 'shopping-cart',
		keywords: ['grocer', 'snack', 'market']
	},
	{
		id: 'eating-out',
		name: 'Eating Out',
		icon: 'utensils-crossed',
		keywords: ['lunch', 'dinner', 'breakfast', 'brunch', 'restaurant', 'takeout']
	},
	{ id: 'coffee', name: 'Coffee', icon: 'coffee', keywords: ['coffee', 'latte', 'espresso'] },
	{ id: 'gas', name: 'Gas', icon: 'fuel', keywords: ['gas', 'fuel'] },
	{
		id: 'shopping',
		name: 'Shopping',
		icon: 'shopping-bag',
		keywords: ['amazon', 'target', 'clothes']
	},
	{
		id: 'subscriptions',
		name: 'Subscriptions',
		icon: 'repeat',
		keywords: ['netflix', 'spotify', 'subscription']
	},
	{ id: 'rent', name: 'Rent', icon: 'house', keywords: ['rent'] }
];

const paymentMethods: MockPaymentMethod[] = [
	{
		id: 'chase',
		kind: 'credit',
		name: 'Chase Sapphire',
		last4: '4417',
		aliases: ['chase sapphire preferred visa', 'chase sapphire preferred', 'sapphire', 'chase']
	},
	{
		id: 'discover',
		kind: 'credit',
		name: 'Discover it',
		last4: '0921',
		aliases: ['discover card', 'discover']
	},
	{
		id: 'apple',
		kind: 'credit',
		name: 'Apple Card',
		last4: null,
		aliases: ['apple card', 'apple']
	},
	{ id: 'venmo', kind: 'p2p', name: 'Venmo', last4: null, aliases: ['venmo'] },
	{ id: 'cash', kind: 'cash', name: 'Cash', last4: null, aliases: ['cash'] }
];

const rules: MerchantRule[] = [
	{ match: 'STAR OSCO', name: 'Star Market', categoryId: 'groceries' },
	{ match: 'NETFLIX', name: 'Netflix', categoryId: 'subscriptions' },
	{ match: 'BLUE BOTTLE', name: 'Blue Bottle Coffee', categoryId: 'coffee' },
	{ match: 'SHELL', name: 'Shell', categoryId: 'gas' }
];

const existing: MockExpense[] = [
	{
		id: 'e1',
		name: 'Netflix',
		amountCents: 1549,
		date: '2026-11-18',
		paymentMethodId: 'chase',
		categoryId: 'subscriptions',
		recurring: true
	},
	{
		id: 'e2',
		name: 'Star Market',
		amountCents: 4210,
		date: '2026-11-17',
		paymentMethodId: 'discover',
		categoryId: 'groceries',
		recurring: false
	}
];

/** Messages waiting in the inbox: forwarded or pasted alerts and typed shorthands. */
const seed: { raw: string; received: string }[] = [
	{
		raw: 'Chase Sapphire Preferred Visa: Your statement is ready. Log in to chase.com to view it.',
		received: 'Today 7:15 AM'
	},
	{
		raw: 'Chase Sapphire Preferred Visa: You made a $15.49 transaction with NETFLIX.COM on Nov 18, 2026 at 6:12 AM ET.',
		received: 'Nov 18'
	},
	{ raw: '12 lunch yesterday', received: 'Today 12:40 PM' },
	{ raw: '5.06 Apple Card, snacks', received: 'Today 3:22 PM' },
	{
		raw: 'Chase Sapphire Preferred Visa: You made a $2 transaction with STAR OSCO 3588 on Nov 20, 2026 at 8:03 PM ET.',
		received: 'Today 8:03 PM'
	},
	{
		raw: 'Discover Card Alert: A transaction of $10.61 at STAR OSCO 3588 on November 20, 2026. No Action needed. See it at https://bit.ly/discover',
		received: 'Today 8:05 PM'
	},
	{
		raw: 'Chase Sapphire Preferred Visa: You made a $6.25 transaction with SQ *BLUE BOTTLE 0412 on Nov 19, 2026 at 9:41 AM ET.',
		received: 'Nov 19'
	}
];

export const load: PageServerLoad = () => {
	if (!dev) error(404, 'Not found');
	return {
		today: '2026-11-20',
		categories,
		paymentMethods,
		rules,
		existing,
		seed,
		// The home page around the inbox, for the "On the home page" view.
		home: mockHome(Temporal.PlainDate.from('2026-11-20'))
	};
};
