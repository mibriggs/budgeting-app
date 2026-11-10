// Icons a category can use. The database stores the key (a Lucide icon name, e.g.
// "shopping-cart"); this maps it to the component. Unknown or missing keys fall back to Tag.
// Each icon is imported individually so only these end up in the bundle.

import Briefcase from '@lucide/svelte/icons/briefcase';
import Candy from '@lucide/svelte/icons/candy';
import Car from '@lucide/svelte/icons/car';
import Dumbbell from '@lucide/svelte/icons/dumbbell';
import Gift from '@lucide/svelte/icons/gift';
import GraduationCap from '@lucide/svelte/icons/graduation-cap';
import Heart from '@lucide/svelte/icons/heart';
import House from '@lucide/svelte/icons/house';
import Laptop from '@lucide/svelte/icons/laptop';
import PawPrint from '@lucide/svelte/icons/paw-print';
import PenTool from '@lucide/svelte/icons/pen-tool';
import PiggyBank from '@lucide/svelte/icons/piggy-bank';
import Repeat from '@lucide/svelte/icons/repeat';
import Shapes from '@lucide/svelte/icons/shapes';
import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
import Sofa from '@lucide/svelte/icons/sofa';
import Stethoscope from '@lucide/svelte/icons/stethoscope';
import Tag from '@lucide/svelte/icons/tag';
import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
import WashingMachine from '@lucide/svelte/icons/washing-machine';
import Zap from '@lucide/svelte/icons/zap';

type Icon = typeof Tag;

export const CATEGORY_ICONS = {
	briefcase: Briefcase,
	candy: Candy,
	car: Car,
	dumbbell: Dumbbell,
	gift: Gift,
	'graduation-cap': GraduationCap,
	heart: Heart,
	house: House,
	laptop: Laptop,
	'paw-print': PawPrint,
	'pen-tool': PenTool,
	'piggy-bank': PiggyBank,
	repeat: Repeat,
	shapes: Shapes,
	'shopping-cart': ShoppingCart,
	sofa: Sofa,
	stethoscope: Stethoscope,
	tag: Tag,
	'utensils-crossed': UtensilsCrossed,
	'washing-machine': WashingMachine,
	zap: Zap
} satisfies Record<string, Icon>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

export function categoryIcon(name: string | null | undefined): Icon {
	return (name && CATEGORY_ICONS[name as CategoryIconName]) || Tag;
}
