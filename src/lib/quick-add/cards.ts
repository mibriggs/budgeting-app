// Major US card networks, issuers, popular card names and pay apps, for Quick add to work out
// which of the user's payment methods a bank alert or a typed note means ("Chase Sapphire
// Preferred Visa", "5.06 apple card snacks", "12 venmo lunch").
//
// Written from general knowledge (late 2026); card names get renamed now and then, so treat it as
// a starting list. Aliases are lowercase and matched as whole words. Longer, more specific aliases
// are tried first, so "sapphire preferred" wins over "sapphire".

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'discover';

export const CARD_NETWORKS: { id: CardNetwork; name: string; aliases: string[] }[] = [
	{ id: 'visa', name: 'Visa', aliases: ['visa'] },
	{ id: 'mastercard', name: 'Mastercard', aliases: ['mastercard', 'master card'] },
	{ id: 'amex', name: 'American Express', aliases: ['american express', 'amex'] },
	{ id: 'discover', name: 'Discover', aliases: ['discover'] }
];

export type CardIssuer = {
	id: string;
	name: string;
	aliases: string[];
	/** Card names, each with the words people use for it. */
	products: { name: string; aliases: string[] }[];
};

export const CARD_ISSUERS: CardIssuer[] = [
	{
		id: 'chase',
		name: 'Chase',
		aliases: ['chase', 'jpmorgan chase'],
		products: [
			{ name: 'Sapphire Preferred', aliases: ['sapphire preferred', 'csp'] },
			{ name: 'Sapphire Reserve', aliases: ['sapphire reserve', 'csr'] },
			{ name: 'Freedom Unlimited', aliases: ['freedom unlimited', 'cfu'] },
			{ name: 'Freedom Flex', aliases: ['freedom flex', 'cff'] },
			{ name: 'Freedom Rise', aliases: ['freedom rise'] },
			{ name: 'Slate Edge', aliases: ['slate edge', 'slate'] },
			{ name: 'Ink Business Preferred', aliases: ['ink preferred', 'ink business preferred'] },
			{ name: 'Ink Business Cash', aliases: ['ink cash', 'ink business cash'] },
			{ name: 'Ink Business Unlimited', aliases: ['ink unlimited', 'ink business unlimited'] },
			{ name: 'Prime Visa', aliases: ['prime visa', 'amazon prime visa', 'amazon visa'] },
			{ name: 'United Explorer', aliases: ['united explorer', 'united quest', 'united club'] },
			{ name: 'Southwest Rapid Rewards', aliases: ['southwest', 'rapid rewards'] },
			{ name: 'Marriott Bonvoy Boundless', aliases: ['bonvoy boundless', 'marriott boundless'] },
			{ name: 'IHG One Rewards', aliases: ['ihg'] },
			{ name: 'Disney Visa', aliases: ['disney visa', 'disney premier'] },
			{ name: 'Sapphire', aliases: ['sapphire'] },
			{ name: 'Freedom', aliases: ['freedom'] }
		]
	},
	{
		id: 'amex',
		name: 'American Express',
		aliases: ['american express', 'amex'],
		products: [
			{ name: 'Platinum', aliases: ['amex platinum', 'platinum card', 'amex plat'] },
			{ name: 'Gold', aliases: ['amex gold', 'gold card'] },
			{ name: 'Green', aliases: ['amex green', 'green card'] },
			{ name: 'Blue Cash Preferred', aliases: ['blue cash preferred', 'bcp'] },
			{ name: 'Blue Cash Everyday', aliases: ['blue cash everyday', 'bce'] },
			{ name: 'Blue Business Plus', aliases: ['blue business plus', 'bbp'] },
			{ name: 'Delta SkyMiles', aliases: ['delta skymiles', 'skymiles', 'delta amex'] },
			{ name: 'Hilton Honors', aliases: ['hilton honors', 'hilton aspire', 'hilton surpass'] },
			{ name: 'Marriott Bonvoy Brilliant', aliases: ['bonvoy brilliant', 'marriott brilliant'] },
			{ name: 'Business Platinum', aliases: ['business platinum'] },
			{ name: 'Business Gold', aliases: ['business gold'] }
		]
	},
	{
		id: 'capital-one',
		name: 'Capital One',
		aliases: ['capital one', 'capitalone', 'cap one', 'cap1'],
		products: [
			{ name: 'Venture X', aliases: ['venture x'] },
			{ name: 'VentureOne', aliases: ['ventureone', 'venture one'] },
			{ name: 'Venture', aliases: ['venture'] },
			{ name: 'Savor', aliases: ['savorone', 'savor one', 'savor'] },
			{ name: 'QuicksilverOne', aliases: ['quicksilverone', 'quicksilver one'] },
			{ name: 'Quicksilver', aliases: ['quicksilver'] },
			{ name: 'Platinum', aliases: ['capital one platinum'] },
			{ name: '360 Checking', aliases: ['360 checking', 'capital one 360'] }
		]
	},
	{
		id: 'citi',
		name: 'Citi',
		aliases: ['citi', 'citibank'],
		products: [
			{ name: 'Double Cash', aliases: ['double cash'] },
			{ name: 'Custom Cash', aliases: ['custom cash'] },
			{ name: 'Strata Premier', aliases: ['strata premier'] },
			{ name: 'Strata Elite', aliases: ['strata elite'] },
			{ name: 'Strata', aliases: ['strata'] },
			{ name: 'Simplicity', aliases: ['simplicity'] },
			{ name: 'Diamond Preferred', aliases: ['diamond preferred'] },
			{ name: 'Costco Anywhere Visa', aliases: ['costco anywhere', 'costco visa', 'costco citi'] },
			{ name: 'AAdvantage', aliases: ['aadvantage', 'citi aa'] }
		]
	},
	{
		id: 'bank-of-america',
		name: 'Bank of America',
		aliases: ['bank of america', 'bofa', 'boa'],
		products: [
			{ name: 'Customized Cash Rewards', aliases: ['customized cash'] },
			{ name: 'Unlimited Cash Rewards', aliases: ['unlimited cash rewards'] },
			{ name: 'Travel Rewards', aliases: ['travel rewards'] },
			{ name: 'Premium Rewards', aliases: ['premium rewards'] },
			{ name: 'Atmos Rewards', aliases: ['atmos', 'alaska airlines'] },
			{ name: 'BankAmericard', aliases: ['bankamericard'] }
		]
	},
	{
		id: 'wells-fargo',
		name: 'Wells Fargo',
		aliases: ['wells fargo', 'wells', 'wf'],
		products: [
			{ name: 'Active Cash', aliases: ['active cash'] },
			{ name: 'Autograph Journey', aliases: ['autograph journey'] },
			{ name: 'Autograph', aliases: ['autograph'] },
			{ name: 'Reflect', aliases: ['reflect'] }
		]
	},
	{
		id: 'discover',
		name: 'Discover',
		aliases: ['discover'],
		products: [
			{ name: 'Discover it Miles', aliases: ['it miles', 'discover miles'] },
			{ name: 'Discover it Chrome', aliases: ['it chrome', 'discover chrome'] },
			{ name: 'Discover it Student', aliases: ['it student'] },
			{ name: 'Discover it', aliases: ['discover it'] }
		]
	},
	{
		id: 'us-bank',
		name: 'U.S. Bank',
		aliases: ['us bank', 'u.s. bank', 'usbank'],
		products: [
			{ name: 'Altitude Reserve', aliases: ['altitude reserve'] },
			{ name: 'Altitude Connect', aliases: ['altitude connect'] },
			{ name: 'Altitude Go', aliases: ['altitude go'] },
			{ name: 'Cash+', aliases: ['cash plus', 'cash+'] },
			{ name: 'Shopper Cash Rewards', aliases: ['shopper cash'] }
		]
	},
	{
		id: 'apple',
		name: 'Apple',
		aliases: ['apple'],
		products: [{ name: 'Apple Card', aliases: ['apple card', 'apple'] }]
	},
	{
		id: 'barclays',
		name: 'Barclays',
		aliases: ['barclays', 'barclaycard'],
		products: [
			{ name: 'AAdvantage Aviator', aliases: ['aviator'] },
			{ name: 'JetBlue', aliases: ['jetblue'] }
		]
	},
	{
		id: 'synchrony',
		name: 'Synchrony',
		aliases: ['synchrony'],
		products: [
			{ name: 'Amazon Store Card', aliases: ['amazon store card'] },
			{ name: 'Verizon Visa', aliases: ['verizon visa'] },
			{ name: "Sam's Club Mastercard", aliases: ["sam's club", 'sams club'] },
			{ name: 'PayPal Credit', aliases: ['paypal credit'] }
		]
	},
	{
		id: 'bilt',
		name: 'Bilt',
		aliases: ['bilt'],
		products: [{ name: 'Bilt Mastercard', aliases: ['bilt'] }]
	},
	{
		id: 'target',
		name: 'Target',
		aliases: ['target circle', 'redcard'],
		products: [{ name: 'Target Circle Card', aliases: ['target circle card', 'redcard'] }]
	},
	{
		id: 'robinhood',
		name: 'Robinhood',
		aliases: ['robinhood'],
		products: [{ name: 'Robinhood Gold Card', aliases: ['robinhood gold'] }]
	},
	// Banks and fintechs mostly seen on debit cards.
	{ id: 'pnc', name: 'PNC', aliases: ['pnc'], products: [] },
	{ id: 'td', name: 'TD Bank', aliases: ['td bank'], products: [] },
	{ id: 'truist', name: 'Truist', aliases: ['truist'], products: [] },
	{ id: 'usaa', name: 'USAA', aliases: ['usaa'], products: [] },
	{ id: 'navy-federal', name: 'Navy Federal', aliases: ['navy federal', 'nfcu'], products: [] },
	{ id: 'citizens', name: 'Citizens', aliases: ['citizens bank'], products: [] },
	{ id: 'ally', name: 'Ally', aliases: ['ally'], products: [] },
	{ id: 'schwab', name: 'Charles Schwab', aliases: ['schwab'], products: [] },
	{ id: 'fidelity', name: 'Fidelity', aliases: ['fidelity'], products: [] },
	{ id: 'sofi', name: 'SoFi', aliases: ['sofi'], products: [] },
	{ id: 'chime', name: 'Chime', aliases: ['chime'], products: [] },
	{ id: 'varo', name: 'Varo', aliases: ['varo'], products: [] }
];

/** Pay apps and cash, matched against the user's p2p and cash payment methods. */
export const PAY_APPS: { name: string; aliases: string[] }[] = [
	{ name: 'Venmo', aliases: ['venmo'] },
	{ name: 'Zelle', aliases: ['zelle'] },
	{ name: 'PayPal', aliases: ['paypal'] },
	{ name: 'Cash App', aliases: ['cash app', 'cashapp'] },
	{ name: 'Apple Cash', aliases: ['apple cash'] },
	{ name: 'Google Pay', aliases: ['google pay', 'gpay'] },
	{ name: 'Cash', aliases: ['cash'] }
];
