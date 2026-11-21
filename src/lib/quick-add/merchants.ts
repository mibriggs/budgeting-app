// Words and well-known US merchant names that point Quick add to a category, so common purchases
// ("STAR OSCO 3588", "12 lunch", "SHELL OIL 5739") get one without asking the model.
//
// Each hint pairs `words` found in the message (lowercase, matched as whole words or phrases) with
// `names`: words likely to be in the matching category's name, in order of preference. The user's
// own category names always win over these (see matchCategory in parse.ts).
//
// Written from general knowledge (late 2026); chains merge and rename, so treat it as a starting
// list. Big-box stores that sell everything (Walmart, Target, Costco) go under shopping.

export const CATEGORY_HINTS: { words: string[]; names: string[] }[] = [
	{
		words: [
			'grocery',
			'groceries',
			'snack',
			'snacks',
			'supermarket',
			// Grocery chains
			'star market',
			'star osco',
			'shaws',
			"shaw's",
			'stop & shop',
			'stop and shop',
			'market basket',
			'hannaford',
			'big y',
			'price chopper',
			'whole foods',
			'whole fds',
			'wholefds',
			"trader joe's",
			'trader joes',
			'wegmans',
			'kroger',
			'safeway',
			'albertsons',
			'vons',
			'jewel osco',
			'jewel-osco',
			'acme markets',
			'tom thumb',
			'randalls',
			'ralphs',
			"fry's food",
			'king soopers',
			'smiths food',
			"smith's food",
			'harris teeter',
			'food lion',
			'giant food',
			'giant eagle',
			'publix',
			'h-e-b',
			'heb',
			'meijer',
			'hy-vee',
			'aldi',
			'lidl',
			'sprouts',
			'winco',
			'food 4 less',
			'save mart',
			'stater bros',
			'shoprite',
			'weis markets',
			'winn-dixie',
			'piggly wiggly',
			'fresh market',
			'instacart'
		],
		names: ['grocer', 'food']
	},
	{
		words: [
			'lunch',
			'dinner',
			'breakfast',
			'brunch',
			'restaurant',
			'takeout',
			'pizza',
			'tacos',
			// Restaurant and delivery chains
			"mcdonald's",
			'mcdonalds',
			'chipotle',
			'chick-fil-a',
			'wendys',
			"wendy's",
			'burger king',
			'taco bell',
			'subway',
			'panera',
			'sweetgreen',
			'shake shack',
			'five guys',
			"domino's",
			'dominos',
			'pizza hut',
			'doordash',
			'uber eats',
			'grubhub'
		],
		names: ['eating', 'dining', 'restaurant', 'takeout', 'food']
	},
	{
		words: [
			'coffee',
			'latte',
			'espresso',
			'cafe',
			'starbucks',
			'dunkin',
			'peets',
			"peet's",
			'blue bottle',
			'tim hortons',
			'dutch bros'
		],
		names: ['coffee', 'cafe']
	},
	{
		words: [
			'gas',
			'fuel',
			'shell',
			'exxon',
			'exxonmobil',
			'mobil',
			'chevron',
			'bp',
			'sunoco',
			'citgo',
			'marathon petro',
			'speedway',
			'wawa',
			'sheetz',
			"casey's",
			'7-eleven',
			'circle k',
			'valero',
			'gulf oil'
		],
		names: ['gas', 'fuel', 'auto', 'car']
	},
	{
		words: [
			'uber',
			'lyft',
			'taxi',
			'parking',
			'toll',
			'ezpass',
			'e-zpass',
			'bus',
			'train',
			'subway fare',
			'mbta',
			'mta',
			'amtrak'
		],
		names: ['transport', 'travel', 'commute', 'car', 'auto']
	},
	{
		words: [
			'netflix',
			'spotify',
			'hulu',
			'disney+',
			'disney plus',
			'hbo max',
			'max.com',
			'youtube premium',
			'apple.com/bill',
			'icloud',
			'audible',
			'patreon',
			'subscription'
		],
		names: ['subscription', 'streaming', 'entertainment']
	},
	{
		words: ['movie', 'movies', 'concert', 'tickets', 'amc theatres', 'fandango', 'ticketmaster'],
		names: ['entertainment', 'fun']
	},
	{
		words: [
			'amazon',
			'amzn',
			'target',
			'walmart',
			'costco',
			"sam's club",
			'bjs wholesale',
			'best buy',
			'home depot',
			"lowe's",
			'ikea',
			'tj maxx',
			'marshalls',
			'etsy',
			'ebay',
			'clothes',
			'shoes'
		],
		names: ['shopping']
	},
	{
		words: [
			'doctor',
			'pharmacy',
			'cvs',
			'walgreens',
			'rite aid',
			'medicine',
			'dentist',
			'urgent care'
		],
		names: ['health', 'medical', 'pharmacy']
	},
	{ words: ['rent', 'mortgage'], names: ['rent', 'housing', 'mortgage', 'home'] },
	{
		words: [
			'electric',
			'water',
			'internet',
			'utilities',
			'comcast',
			'xfinity',
			'verizon',
			'eversource'
		],
		names: ['utilit', 'bill']
	},
	{ words: ['gym', 'fitness', 'planet fitness', 'equinox'], names: ['fitness', 'gym'] },
	{ words: ['vet', 'dog', 'cat', 'pet', 'petco', 'petsmart', 'chewy'], names: ['pet'] }
];

/**
 * The everyday brand name for merchants banks write in store-specific or shortened ways, so the
 * expense reads the way people say it ("STAR OSCO 3588" → "Star Market"). `match` is lowercase
 * and matched as whole words or phrases against the merchant text, after store numbers and
 * payment-processor prefixes are dropped. First match wins.
 */
export const MERCHANT_NAMES: { match: string[]; name: string }[] = [
	// Grocery stores with an in-store pharmacy, named by the grocery brand.
	{ match: ['star osco', 'star market', 'star mkt'], name: 'Star Market' },
	{ match: ['shaws osco', "shaw's osco", 'shaws', "shaw's"], name: "Shaw's" },
	{ match: ['jewel osco', 'jewel-osco'], name: 'Jewel-Osco' },
	{ match: ['acme markets', 'acme mkt'], name: 'Acme' },
	{ match: ['stop & shop', 'stop and shop', 'stop&shop'], name: 'Stop & Shop' },
	{ match: ['market basket', 'demoulas'], name: 'Market Basket' },
	{ match: ['whole foods', 'wholefds', 'whole fds', 'wfm'], name: 'Whole Foods' },
	{ match: ["trader joe's", 'trader joes', 'trader joe'], name: "Trader Joe's" },
	{ match: ['h-e-b', 'heb'], name: 'H-E-B' },
	{ match: ['harris teeter'], name: 'Harris Teeter' },
	{ match: ['king soopers'], name: 'King Soopers' },
	// Pharmacy-only chains keep their own name (and their pharmacy category).
	{ match: ['cvs/pharmacy', 'cvs pharmacy', 'cvs'], name: 'CVS' },
	{ match: ['walgreens'], name: 'Walgreens' },
	{ match: ['rite aid'], name: 'Rite Aid' },
	// Other common shortenings.
	{ match: ['amzn mktp', 'amzn', 'amazon mktplace', 'amazon mkt', 'amazon'], name: 'Amazon' },
	{ match: ['wal-mart', 'walmart', 'wm supercenter'], name: 'Walmart' },
	{ match: ["mcdonald's", 'mcdonalds'], name: "McDonald's" },
	{ match: ['starbucks'], name: 'Starbucks' },
	{ match: ['dunkin'], name: "Dunkin'" },
	{ match: ['doordash', 'dd doordash'], name: 'DoorDash' },
	{ match: ['uber eats', 'ubereats'], name: 'Uber Eats' },
	{ match: ['netflix'], name: 'Netflix' },
	{ match: ['spotify'], name: 'Spotify' }
];

/** Words in a category's name that mean pharmacy or health. A grocery chain (which often has a
 *  pharmacy counter) beats these: such purchases default to groceries. */
export const PHARMACY_CATEGORY_WORDS = ['pharm', 'health', 'medic', 'drug'];
