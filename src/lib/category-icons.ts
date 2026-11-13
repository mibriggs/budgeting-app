// Icons a category can use. The database stores the key (a Lucide icon name, e.g.
// "shopping-cart"); this maps it to the component and a readable name, and groups them for the
// picker. Unknown or missing keys fall back to Tag. Each icon is imported individually so only
// these end up in the bundle.
//
// Adding one: import it, add it to CATEGORY_ICONS and to a group. No migration is needed (the
// database only checks the key's format); the server checks keys against this list.

import Baby from '@lucide/svelte/icons/baby';
import Banknote from '@lucide/svelte/icons/banknote';
import Bath from '@lucide/svelte/icons/bath';
import Beer from '@lucide/svelte/icons/beer';
import Bike from '@lucide/svelte/icons/bike';
import BookOpen from '@lucide/svelte/icons/book-open';
import Brain from '@lucide/svelte/icons/brain';
import Briefcase from '@lucide/svelte/icons/briefcase';
import Building from '@lucide/svelte/icons/building';
import Bus from '@lucide/svelte/icons/bus';
import Cake from '@lucide/svelte/icons/cake';
import Camera from '@lucide/svelte/icons/camera';
import Candy from '@lucide/svelte/icons/candy';
import Car from '@lucide/svelte/icons/car';
import CarTaxiFront from '@lucide/svelte/icons/car-taxi-front';
import Coffee from '@lucide/svelte/icons/coffee';
import Coins from '@lucide/svelte/icons/coins';
import CreditCard from '@lucide/svelte/icons/credit-card';
import Droplet from '@lucide/svelte/icons/droplet';
import Dumbbell from '@lucide/svelte/icons/dumbbell';
import Film from '@lucide/svelte/icons/film';
import Flame from '@lucide/svelte/icons/flame';
import Fuel from '@lucide/svelte/icons/fuel';
import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
import Gavel from '@lucide/svelte/icons/gavel';
import Gift from '@lucide/svelte/icons/gift';
import Glasses from '@lucide/svelte/icons/glasses';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import Hammer from '@lucide/svelte/icons/hammer';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import HandHeart from '@lucide/svelte/icons/hand-heart';
import Headphones from '@lucide/svelte/icons/headphones';
import Heart from '@lucide/svelte/icons/heart';
import Hotel from '@lucide/svelte/icons/hotel';
import House from '@lucide/svelte/icons/house';
import Landmark from '@lucide/svelte/icons/landmark';
import Laptop from '@lucide/svelte/icons/laptop';
import Luggage from '@lucide/svelte/icons/luggage';
import Package from '@lucide/svelte/icons/package';
import Palette from '@lucide/svelte/icons/palette';
import PawPrint from '@lucide/svelte/icons/paw-print';
import PenTool from '@lucide/svelte/icons/pen-tool';
import Percent from '@lucide/svelte/icons/percent';
import PiggyBank from '@lucide/svelte/icons/piggy-bank';
import Pill from '@lucide/svelte/icons/pill';
import Pizza from '@lucide/svelte/icons/pizza';
import Plane from '@lucide/svelte/icons/plane';
import Receipt from '@lucide/svelte/icons/receipt';
import Repeat from '@lucide/svelte/icons/repeat';
import Sandwich from '@lucide/svelte/icons/sandwich';
import Scissors from '@lucide/svelte/icons/scissors';
import Shapes from '@lucide/svelte/icons/shapes';
import ShieldCheck from '@lucide/svelte/icons/shield-check';
import Shirt from '@lucide/svelte/icons/shirt';
import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
import Smartphone from '@lucide/svelte/icons/smartphone';
import Sofa from '@lucide/svelte/icons/sofa';
import Sparkles from '@lucide/svelte/icons/sparkles';
import SprayCan from '@lucide/svelte/icons/spray-can';
import Sprout from '@lucide/svelte/icons/sprout';
import SquareParking from '@lucide/svelte/icons/square-parking';
import Stethoscope from '@lucide/svelte/icons/stethoscope';
import Store from '@lucide/svelte/icons/store';
import Tag from '@lucide/svelte/icons/tag';
import Tent from '@lucide/svelte/icons/tent';
import Ticket from '@lucide/svelte/icons/ticket';
import ToyBrick from '@lucide/svelte/icons/toy-brick';
import TrainFront from '@lucide/svelte/icons/train-front';
import TreePine from '@lucide/svelte/icons/tree-pine';
import TrendingUp from '@lucide/svelte/icons/trending-up';
import Trophy from '@lucide/svelte/icons/trophy';
import Tv from '@lucide/svelte/icons/tv';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import Wallet from '@lucide/svelte/icons/wallet';
import WashingMachine from '@lucide/svelte/icons/washing-machine';
import Wifi from '@lucide/svelte/icons/wifi';
import Wine from '@lucide/svelte/icons/wine';
import Wrench from '@lucide/svelte/icons/wrench';
import Zap from '@lucide/svelte/icons/zap';

type Icon = typeof Tag;

/** Every icon a category can use, with the name screen readers and tooltips use. */
export const CATEGORY_ICONS = {
	baby: { icon: Baby, label: 'Baby' },
	banknote: { icon: Banknote, label: 'Cash' },
	bath: { icon: Bath, label: 'Toiletries' },
	beer: { icon: Beer, label: 'Bars' },
	bike: { icon: Bike, label: 'Bike' },
	'book-open': { icon: BookOpen, label: 'Books' },
	brain: { icon: Brain, label: 'Therapy' },
	briefcase: { icon: Briefcase, label: 'Work' },
	building: { icon: Building, label: 'Apartment or HOA' },
	bus: { icon: Bus, label: 'Bus' },
	cake: { icon: Cake, label: 'Birthdays' },
	camera: { icon: Camera, label: 'Photography' },
	candy: { icon: Candy, label: 'Candy' },
	car: { icon: Car, label: 'Car' },
	'car-taxi-front': { icon: CarTaxiFront, label: 'Rideshare and taxi' },
	coffee: { icon: Coffee, label: 'Coffee' },
	coins: { icon: Coins, label: 'Coins' },
	'credit-card': { icon: CreditCard, label: 'Credit card' },
	droplet: { icon: Droplet, label: 'Water' },
	dumbbell: { icon: Dumbbell, label: 'Fitness' },
	film: { icon: Film, label: 'Movies' },
	flame: { icon: Flame, label: 'Gas and heating' },
	fuel: { icon: Fuel, label: 'Fuel' },
	'gamepad-2': { icon: Gamepad2, label: 'Games' },
	gavel: { icon: Gavel, label: 'Legal' },
	gift: { icon: Gift, label: 'Gift' },
	glasses: { icon: Glasses, label: 'Glasses' },
	'graduation-cap': { icon: GraduationCap, label: 'Education' },
	hammer: { icon: Hammer, label: 'Home improvement' },
	'hand-coins': { icon: HandCoins, label: 'Loan or payback' },
	'hand-heart': { icon: HandHeart, label: 'Charity' },
	headphones: { icon: Headphones, label: 'Music' },
	heart: { icon: Heart, label: 'Heart' },
	hotel: { icon: Hotel, label: 'Lodging' },
	house: { icon: House, label: 'Home' },
	landmark: { icon: Landmark, label: 'Bank or taxes' },
	laptop: { icon: Laptop, label: 'Tech' },
	luggage: { icon: Luggage, label: 'Travel' },
	package: { icon: Package, label: 'Package' },
	palette: { icon: Palette, label: 'Hobbies' },
	'paw-print': { icon: PawPrint, label: 'Pets' },
	'pen-tool': { icon: PenTool, label: 'Freelance' },
	percent: { icon: Percent, label: 'Fees and interest' },
	'piggy-bank': { icon: PiggyBank, label: 'Savings' },
	pill: { icon: Pill, label: 'Medicine' },
	pizza: { icon: Pizza, label: 'Takeout' },
	plane: { icon: Plane, label: 'Flights' },
	receipt: { icon: Receipt, label: 'Bills' },
	repeat: { icon: Repeat, label: 'Subscriptions' },
	sandwich: { icon: Sandwich, label: 'Lunch' },
	scissors: { icon: Scissors, label: 'Haircut' },
	shapes: { icon: Shapes, label: 'Misc.' },
	'shield-check': { icon: ShieldCheck, label: 'Insurance' },
	shirt: { icon: Shirt, label: 'Clothes' },
	'shopping-bag': { icon: ShoppingBag, label: 'Shopping' },
	'shopping-cart': { icon: ShoppingCart, label: 'Groceries' },
	smartphone: { icon: Smartphone, label: 'Phone' },
	sofa: { icon: Sofa, label: 'Furniture' },
	sparkles: { icon: Sparkles, label: 'Beauty' },
	'spray-can': { icon: SprayCan, label: 'Cleaning' },
	sprout: { icon: Sprout, label: 'Garden' },
	'square-parking': { icon: SquareParking, label: 'Parking' },
	stethoscope: { icon: Stethoscope, label: 'Health' },
	store: { icon: Store, label: 'Business' },
	tag: { icon: Tag, label: 'Tag' },
	tent: { icon: Tent, label: 'Outdoors' },
	ticket: { icon: Ticket, label: 'Events' },
	'toy-brick': { icon: ToyBrick, label: 'Kids and toys' },
	'train-front': { icon: TrainFront, label: 'Train' },
	'tree-pine': { icon: TreePine, label: 'Holidays' },
	'trending-up': { icon: TrendingUp, label: 'Investments' },
	trophy: { icon: Trophy, label: 'Sports' },
	tv: { icon: Tv, label: 'TV and streaming' },
	'utensils-crossed': { icon: UtensilsCrossed, label: 'Eating out' },
	wallet: { icon: Wallet, label: 'Allowance' },
	'washing-machine': { icon: WashingMachine, label: 'Laundry' },
	wifi: { icon: Wifi, label: 'Internet' },
	wine: { icon: Wine, label: 'Drinks' },
	wrench: { icon: Wrench, label: 'Repairs' },
	zap: { icon: Zap, label: 'Electricity' }
} satisfies Record<string, { icon: Icon; label: string }>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

/** The picker's sections, in order. Every icon appears in exactly one. */
export const CATEGORY_ICON_GROUPS: { label: string; icons: CategoryIconName[] }[] = [
	{
		label: 'Home and bills',
		icons: [
			'house',
			'sofa',
			'zap',
			'flame',
			'droplet',
			'wifi',
			'smartphone',
			'tv',
			'repeat',
			'receipt',
			'wrench',
			'washing-machine',
			'building',
			'hammer',
			'spray-can'
		]
	},
	{
		label: 'Food and drink',
		icons: [
			'shopping-cart',
			'utensils-crossed',
			'pizza',
			'coffee',
			'wine',
			'candy',
			'beer',
			'sandwich'
		]
	},
	{
		label: 'Getting around',
		icons: [
			'car',
			'fuel',
			'square-parking',
			'bus',
			'train-front',
			'bike',
			'plane',
			'luggage',
			'car-taxi-front',
			'hotel'
		]
	},
	{
		label: 'Health and personal',
		icons: [
			'stethoscope',
			'pill',
			'dumbbell',
			'scissors',
			'sparkles',
			'shirt',
			'glasses',
			'baby',
			'paw-print',
			'brain',
			'bath',
			'toy-brick'
		]
	},
	{
		label: 'Fun and learning',
		icons: [
			'ticket',
			'film',
			'headphones',
			'gamepad-2',
			'book-open',
			'palette',
			'tent',
			'graduation-cap',
			'laptop',
			'camera',
			'trophy'
		]
	},
	{
		label: 'Money',
		icons: [
			'piggy-bank',
			'trending-up',
			'credit-card',
			'banknote',
			'coins',
			'hand-coins',
			'landmark',
			'shield-check',
			'percent',
			'gavel',
			'wallet'
		]
	},
	{
		label: 'Work and other',
		icons: [
			'briefcase',
			'pen-tool',
			'store',
			'shopping-bag',
			'package',
			'gift',
			'heart',
			'hand-heart',
			'sprout',
			'shapes',
			'tag',
			'cake',
			'tree-pine'
		]
	}
];

export function isCategoryIconName(name: string): name is CategoryIconName {
	return Object.hasOwn(CATEGORY_ICONS, name);
}

export function categoryIcon(name: string | null | undefined): Icon {
	return (name && isCategoryIconName(name) && CATEGORY_ICONS[name].icon) || Tag;
}
