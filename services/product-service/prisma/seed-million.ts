import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 2000;
const TARGET_PRODUCTS = 1_000_000;
const PROGRESS_INTERVAL = 50000;

// Data directory
const DATA_DIR = fs.existsSync('/app/data')
  ? '/app/data'
  : path.join(__dirname, '../../../data');

// ============================================================================
// CATEGORY HIERARCHY
// ============================================================================
const CATEGORY_HIERARCHY: Record<string, { description: string; children: Record<string, string> }> = {
  Electronics: {
    description: 'Electronic devices and gadgets',
    children: {
      'Computers & Laptops': 'Desktop computers, laptops, and accessories',
      'Mobile Phones': 'Smartphones, feature phones, and accessories',
      'Audio & Headphones': 'Headphones, speakers, and audio equipment',
      'Cameras & Photography': 'Digital cameras, lenses, and accessories',
      'TV & Home Theater': 'Televisions, soundbars, and streaming devices',
      'Gaming': 'Gaming consoles, games, and accessories',
      'Wearables': 'Smartwatches, fitness trackers, and wearable tech',
      'Computer Components': 'CPUs, GPUs, RAM, and PC parts',
      'Networking': 'Routers, switches, and network equipment',
      'Smart Home': 'Smart speakers, lights, and home automation',
    },
  },
  'Home & Garden': {
    description: 'Home improvement, furniture, and garden supplies',
    children: {
      Furniture: 'Indoor and outdoor furniture',
      'Kitchen & Dining': 'Cookware, appliances, and dining essentials',
      'Bedding & Bath': 'Bedding, towels, and bathroom accessories',
      'Home Decor': 'Decorative items, art, and lighting',
      'Garden & Outdoor': 'Garden tools, plants, and outdoor equipment',
      'Storage & Organization': 'Storage solutions and organizers',
      'Cleaning Supplies': 'Cleaning tools and products',
      'Home Improvement': 'Tools, hardware, and DIY supplies',
    },
  },
  'Clothing & Fashion': {
    description: 'Apparel, shoes, and fashion accessories',
    children: {
      "Men's Clothing": "Men's shirts, pants, jackets, and more",
      "Women's Clothing": "Women's dresses, tops, bottoms, and more",
      "Kids' Clothing": "Children's apparel",
      Shoes: 'Footwear for all occasions',
      'Bags & Accessories': 'Handbags, wallets, belts, and accessories',
      Jewelry: 'Fine and fashion jewelry',
      Watches: 'Analog, digital, and smart watches',
      Activewear: 'Sports and athletic clothing',
    },
  },
  'Health & Beauty': {
    description: 'Personal care, wellness, and beauty products',
    children: {
      Skincare: 'Facial care, moisturizers, and treatments',
      Haircare: 'Shampoo, conditioner, and styling products',
      Makeup: 'Cosmetics and beauty tools',
      'Personal Care': 'Hygiene and grooming essentials',
      'Health & Wellness': 'Vitamins, supplements, and health devices',
      Fragrances: 'Perfumes and colognes',
      'Oral Care': 'Dental hygiene products',
      "Men's Grooming": 'Shaving and grooming products',
    },
  },
  'Sports & Outdoors': {
    description: 'Sports equipment and outdoor gear',
    children: {
      'Exercise & Fitness': 'Gym equipment and fitness accessories',
      'Outdoor Recreation': 'Camping, hiking, and outdoor gear',
      'Team Sports': 'Equipment for team sports',
      'Water Sports': 'Swimming, surfing, and water gear',
      Cycling: 'Bikes, helmets, and cycling accessories',
      Running: 'Running shoes and accessories',
      Golf: 'Golf clubs and equipment',
      Fishing: 'Fishing gear and tackle',
    },
  },
  'Toys & Games': {
    description: 'Toys, games, and entertainment',
    children: {
      'Action Figures': 'Collectible figures and playsets',
      'Board Games': 'Board games and puzzles',
      'Building Toys': 'LEGO, blocks, and construction sets',
      'Dolls & Stuffed Animals': 'Dolls, plush toys, and accessories',
      'Outdoor Play': 'Outdoor toys and play equipment',
      'Educational Toys': 'Learning and STEM toys',
      'Remote Control': 'RC cars, drones, and robots',
      'Video Games': 'Games and gaming accessories',
    },
  },
  'Office & School': {
    description: 'Office supplies and school essentials',
    children: {
      'Office Supplies': 'Stationery, paper, and desk accessories',
      'Office Furniture': 'Desks, chairs, and storage',
      'School Supplies': 'Notebooks, backpacks, and study aids',
      'Printers & Ink': 'Printers, scanners, and supplies',
      'Office Electronics': 'Calculators, shredders, and office machines',
    },
  },
  Automotive: {
    description: 'Auto parts, accessories, and tools',
    children: {
      'Car Electronics': 'Audio, GPS, and car gadgets',
      'Interior Accessories': 'Seat covers, mats, and organizers',
      'Exterior Accessories': 'Car covers, lights, and decals',
      'Tools & Equipment': 'Auto repair and maintenance tools',
      'Car Care': 'Cleaning and maintenance products',
      'Parts & Accessories': 'Replacement parts and upgrades',
    },
  },
  'Pet Supplies': {
    description: 'Products for pets',
    children: {
      'Dog Supplies': 'Food, toys, and accessories for dogs',
      'Cat Supplies': 'Food, toys, and accessories for cats',
      'Fish & Aquarium': 'Aquarium supplies and fish food',
      'Bird Supplies': 'Bird cages, food, and accessories',
      'Small Animal Supplies': 'Supplies for hamsters, rabbits, etc.',
    },
  },
  'Baby & Kids': {
    description: 'Products for babies and children',
    children: {
      'Baby Gear': 'Strollers, car seats, and carriers',
      'Baby Care': 'Diapers, wipes, and baby essentials',
      Nursery: 'Cribs, bedding, and nursery decor',
      Feeding: 'Bottles, high chairs, and feeding supplies',
      'Baby Toys': 'Age-appropriate toys for infants',
    },
  },
  'Food & Grocery': {
    description: 'Food, beverages, and grocery items',
    children: {
      'Snacks & Candy': 'Chips, cookies, and confectionery',
      Beverages: 'Coffee, tea, and drinks',
      'Pantry Staples': 'Canned goods, pasta, and dry goods',
      'Organic & Natural': 'Organic and health foods',
      'Gourmet Foods': 'Specialty and gourmet items',
    },
  },
  'Books & Media': {
    description: 'Books, music, and entertainment',
    children: {
      Books: 'Fiction, non-fiction, and educational',
      eBooks: 'Digital books and publications',
      Music: 'CDs, vinyl, and digital music',
      'Movies & TV': 'DVDs, Blu-rays, and streaming',
      Magazines: 'Periodicals and subscriptions',
    },
  },
};

// Brand pools by category
const BRANDS: Record<string, string[]> = {
  electronics: ['Samsung', 'Apple', 'Sony', 'LG', 'Bose', 'JBL', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Acer', 'Microsoft', 'Google', 'Anker', 'Logitech', 'Razer', 'Corsair', 'SteelSeries', 'HyperX', 'Canon', 'Nikon', 'Fujifilm', 'GoPro', 'DJI', 'Roku', 'Amazon', 'Philips', 'Panasonic', 'TCL', 'Vizio', 'Nvidia', 'AMD', 'Intel', 'Western Digital', 'Seagate', 'Kingston', 'Crucial', 'MSI', 'Gigabyte', 'EVGA'],
  clothing: ['Nike', 'Adidas', 'Puma', 'Under Armour', "Levi's", 'H&M', 'Zara', 'Gap', 'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren', 'Gucci', 'Versace', 'Armani', 'Hugo Boss', 'Lacoste', 'Champion', 'The North Face', 'Patagonia', 'Columbia', 'Uniqlo', 'Express', 'Banana Republic', 'J.Crew', 'Brooks Brothers'],
  home: ['IKEA', 'Wayfair', 'Ashley', 'Pottery Barn', 'West Elm', 'Crate & Barrel', 'Williams Sonoma', 'KitchenAid', 'Cuisinart', 'Dyson', 'Shark', 'iRobot', 'Bissell', 'Black+Decker', 'DeWalt', 'Makita', 'Bosch', 'Milwaukee', 'Craftsman', 'Stanley', 'Rubbermaid', 'OXO', 'Ninja', 'Instant Pot', 'Keurig'],
  beauty: ["L'Oreal", 'Maybelline', 'NYX', 'MAC', 'Estee Lauder', 'Clinique', 'Neutrogena', 'CeraVe', 'The Ordinary', 'Olay', 'Dove', 'Nivea', 'Garnier', 'Revlon', 'Covergirl', 'Urban Decay', 'Too Faced', 'Fenty Beauty', 'Charlotte Tilbury', 'Drunk Elephant', 'Glossier', 'Kiehl\'s', 'La Mer', 'SK-II'],
  sports: ['Nike', 'Adidas', 'Under Armour', 'Puma', 'Reebok', 'New Balance', 'ASICS', 'Brooks', 'Wilson', 'Spalding', 'Callaway', 'TaylorMade', 'Titleist', 'Yeti', 'Coleman', 'REI', 'Patagonia', 'The North Face', 'Oakley', 'Garmin', 'Fitbit', 'Peloton', 'Bowflex', 'NordicTrack'],
  toys: ['LEGO', 'Hasbro', 'Mattel', 'Fisher-Price', 'Nerf', 'Hot Wheels', 'Barbie', 'Nintendo', 'PlayStation', 'Xbox', 'Funko', 'Melissa & Doug', 'VTech', 'LeapFrog', 'Ravensburger', 'Spin Master', 'Bandai', 'Playmobil', 'Crayola', 'Play-Doh'],
  automotive: ['Bosch', 'Michelin', 'Goodyear', 'Bridgestone', '3M', 'Meguiar\'s', 'Chemical Guys', 'WeatherTech', 'Thule', 'Yakima', 'Pioneer', 'Kenwood', 'JBL', 'Garmin', 'Cobra', 'NOCO', 'Optima', 'ACDelco', 'Denso', 'NGK'],
  pets: ['Purina', 'Blue Buffalo', 'Hill\'s', 'Royal Canin', 'Pedigree', 'IAMS', 'Wellness', 'Chewy', 'Kong', 'Nylabone', 'PetSafe', 'Furminator', 'Arm & Hammer', 'Fresh Step', 'Tidy Cats'],
  baby: ['Pampers', 'Huggies', 'Graco', 'Chicco', 'Fisher-Price', 'Baby Einstein', 'Skip Hop', 'Munchkin', 'Dr. Brown\'s', 'Philips Avent', 'Medela', 'Uppababy', 'Britax', 'Ergobaby', 'Baby Jogger'],
  food: ['Nestle', 'Kraft', 'General Mills', 'Kellogg\'s', 'PepsiCo', 'Coca-Cola', 'Starbucks', 'Whole Foods', '365', 'Trader Joe\'s', 'KIND', 'Annie\'s', 'Clif Bar', 'Nature Valley', 'Quaker'],
  default: ['AmazonBasics', 'ProBrand', 'TechPro', 'HomeMax', 'ValueChoice', 'PrimeLine', 'QualityFirst', 'BestValue', 'TopTier', 'EliteChoice', 'SmartBuy', 'UltraMax', 'PremiumPro', 'NextGen', 'FirstRate'],
};

const adjectives = [
  'Premium', 'Ultra', 'Pro', 'Elite', 'Advanced', 'Essential', 'Classic',
  'Modern', 'Smart', 'Wireless', 'Portable', 'Compact', 'Heavy-Duty',
  'Professional', 'Gaming', 'Budget', 'Enterprise', 'Studio', 'Travel',
  'Sport', 'Outdoor', 'Home', 'Office', 'Industrial', 'Mini', 'Max',
  'Slim', 'Turbo', 'Lightning', 'Thunder', 'Stealth', 'Quantum', 'Deluxe',
  'Signature', 'Limited', 'Special', 'Exclusive', 'Original', 'Enhanced',
];

const productTypes: Record<string, string[]> = {
  electronics: ['Laptop', 'Smartphone', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Speaker', 'Camera', 'Webcam', 'Microphone', 'Router', 'Hard Drive', 'SSD', 'RAM', 'GPU', 'CPU', 'Motherboard', 'Power Supply', 'Case', 'Charger', 'Cable', 'Adapter', 'Hub', 'Dock', 'Stand', 'Controller', 'VR Headset', 'Drone', 'Smart Display', 'Projector', 'Printer', 'Scanner', 'Smart Speaker', 'Streaming Device', 'Gaming Console'],
  clothing: ['T-Shirt', 'Polo Shirt', 'Dress Shirt', 'Jeans', 'Pants', 'Shorts', 'Jacket', 'Coat', 'Sweater', 'Hoodie', 'Dress', 'Skirt', 'Blouse', 'Suit', 'Blazer', 'Cardigan', 'Tank Top', 'Leggings', 'Joggers', 'Underwear', 'Socks', 'Belt', 'Tie', 'Scarf', 'Hat', 'Gloves'],
  home: ['Sofa', 'Chair', 'Table', 'Desk', 'Bed Frame', 'Mattress', 'Dresser', 'Nightstand', 'Bookshelf', 'Cabinet', 'Lamp', 'Rug', 'Curtain', 'Mirror', 'Clock', 'Vase', 'Pillow', 'Blanket', 'Towel', 'Cookware Set', 'Knife Set', 'Blender', 'Mixer', 'Toaster', 'Coffee Maker', 'Air Fryer', 'Vacuum', 'Mop', 'Broom', 'Storage Bin', 'Organizer'],
  beauty: ['Moisturizer', 'Cleanser', 'Serum', 'Sunscreen', 'Face Mask', 'Toner', 'Eye Cream', 'Lip Balm', 'Foundation', 'Concealer', 'Mascara', 'Lipstick', 'Eyeshadow', 'Blush', 'Bronzer', 'Primer', 'Setting Spray', 'Shampoo', 'Conditioner', 'Hair Mask', 'Styling Gel', 'Perfume', 'Cologne', 'Deodorant', 'Body Wash', 'Lotion'],
  sports: ['Running Shoes', 'Training Shoes', 'Cleats', 'Sneakers', 'Yoga Mat', 'Dumbbells', 'Kettlebell', 'Resistance Band', 'Exercise Ball', 'Jump Rope', 'Treadmill', 'Exercise Bike', 'Rowing Machine', 'Elliptical', 'Weight Bench', 'Pull-up Bar', 'Foam Roller', 'Sports Bag', 'Water Bottle', 'Fitness Tracker', 'Heart Rate Monitor', 'Bicycle', 'Helmet', 'Tent', 'Sleeping Bag', 'Backpack', 'Hiking Boots', 'Fishing Rod', 'Golf Club', 'Tennis Racket', 'Basketball', 'Football', 'Soccer Ball'],
  toys: ['Action Figure', 'Doll', 'Stuffed Animal', 'Building Set', 'Board Game', 'Puzzle', 'RC Car', 'Drone Toy', 'Robot Kit', 'Science Kit', 'Art Set', 'Play Set', 'Outdoor Toy', 'Water Toy', 'Video Game', 'Card Game', 'Educational Toy', 'Musical Toy', 'Ride-On Toy', 'Pretend Play Set'],
  default: ['Product', 'Item', 'Set', 'Kit', 'Bundle', 'Pack', 'Collection', 'System', 'Device', 'Tool', 'Accessory', 'Gadget', 'Equipment', 'Supplies', 'Essentials'],
};

// ============================================================================
// UTILITIES
// ============================================================================
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrice(): number {
  const ranges = [
    { min: 4.99, max: 24.99, weight: 15 },
    { min: 25, max: 49.99, weight: 20 },
    { min: 50, max: 99.99, weight: 25 },
    { min: 100, max: 249.99, weight: 20 },
    { min: 250, max: 499.99, weight: 10 },
    { min: 500, max: 999.99, weight: 6 },
    { min: 1000, max: 2499.99, weight: 3 },
    { min: 2500, max: 4999.99, weight: 1 },
  ];

  const totalWeight = ranges.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;
  for (const range of ranges) {
    random -= range.weight;
    if (random <= 0) {
      return Math.round((range.min + Math.random() * (range.max - range.min)) * 100) / 100;
    }
  }
  return 99.99;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
    .substring(0, 70);
}

function getCategoryGroup(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  if (/electronic|computer|phone|audio|camera|tv|gaming|wearable|smart|network|component/.test(lower)) return 'electronics';
  if (/cloth|fashion|shoe|bag|jewelry|watch|activewear/.test(lower)) return 'clothing';
  if (/home|garden|furniture|kitchen|bed|bath|decor|storage|clean|improvement/.test(lower)) return 'home';
  if (/health|beauty|skin|hair|makeup|personal|fragrance|oral|groom/.test(lower)) return 'beauty';
  if (/sport|outdoor|fitness|water|cycling|running|golf|fish/.test(lower)) return 'sports';
  if (/toy|game|action|board|building|doll|educational|remote|video/.test(lower)) return 'toys';
  if (/auto|car|vehicle/.test(lower)) return 'automotive';
  if (/pet|dog|cat|fish|bird/.test(lower)) return 'pets';
  if (/baby|kid|nursery|feeding/.test(lower)) return 'baby';
  if (/food|grocery|snack|beverage|pantry/.test(lower)) return 'food';
  return 'default';
}

// ============================================================================
// SMART CATEGORY MATCHING - Maps product text to appropriate categories
// ============================================================================
const CATEGORY_KEYWORDS: Record<string, { keywords: RegExp; subcategories: Record<string, RegExp> }> = {
  electronics: {
    keywords: /\b(laptop|computer|pc|desktop|macbook|chromebook|notebook|phone|smartphone|iphone|samsung galaxy|android|pixel|tablet|ipad|kindle|monitor|display|screen|keyboard|mouse|trackpad|headphone|earphone|earbud|airpod|speaker|soundbar|subwoofer|amplifier|camera|dslr|mirrorless|lens|tripod|gopro|webcam|microphone|router|modem|wifi|ethernet|switch|hub|hard drive|ssd|hdd|storage|memory|ram|cpu|processor|gpu|graphics card|motherboard|power supply|case|fan|cooler|charger|cable|adapter|usb|hdmi|thunderbolt|dock|stand|controller|gamepad|joystick|vr|virtual reality|drone|smart watch|fitness tracker|wearable|echo|alexa|google home|smart speaker|streaming|roku|fire tv|apple tv|chromecast|projector|printer|scanner|gaming|console|playstation|xbox|nintendo|switch)\b/i,
    subcategories: {
      'Computers & Laptops': /\b(laptop|computer|pc|desktop|macbook|chromebook|notebook|imac|mac mini|mac pro|workstation|all-in-one)\b/i,
      'Mobile Phones': /\b(phone|smartphone|iphone|samsung galaxy|android|pixel|mobile|cellular|5g|4g|sim)\b/i,
      'Audio & Headphones': /\b(headphone|earphone|earbud|airpod|speaker|soundbar|subwoofer|amplifier|audio|sound|stereo|hi-fi|bluetooth speaker|portable speaker|home theater audio)\b/i,
      'Cameras & Photography': /\b(camera|dslr|mirrorless|lens|tripod|gopro|photography|photo|camcorder|action cam|instant camera|film camera)\b/i,
      'TV & Home Theater': /\b(tv|television|oled|qled|led tv|smart tv|4k|8k|home theater|soundbar|streaming device|roku|fire tv|apple tv|chromecast|projector)\b/i,
      'Gaming': /\b(gaming|console|playstation|ps4|ps5|xbox|nintendo|switch|game controller|gamepad|joystick|vr headset|oculus|gaming chair|gaming desk|esports)\b/i,
      'Wearables': /\b(smart watch|smartwatch|fitness tracker|fitness band|apple watch|galaxy watch|garmin|fitbit|wearable|activity tracker)\b/i,
    },
  },
  clothing: {
    keywords: /\b(shirt|t-shirt|tee|polo|blouse|top|dress|skirt|pants|jeans|trousers|shorts|jacket|coat|sweater|hoodie|cardigan|blazer|suit|vest|underwear|bra|panties|boxers|briefs|socks|leggings|joggers|sweatpants|activewear|sportswear|yoga|athletic|shoe|sneaker|boot|sandal|heel|flat|loafer|oxford|running shoe|basketball shoe|tennis shoe|hiking boot|bag|handbag|purse|backpack|tote|clutch|wallet|belt|tie|scarf|hat|cap|beanie|glove|sunglasses|jewelry|necklace|bracelet|earring|ring|watch|fashion|apparel|clothing|outfit|wear)\b/i,
    subcategories: {
      "Men's Clothing": /\b(men'?s|male|guy'?s|man'?s|gentleman)\b.*\b(shirt|pants|jeans|jacket|suit|blazer|sweater|hoodie|shorts|underwear|boxers|briefs)\b|\b(shirt|pants|jeans|jacket|suit|blazer|sweater|hoodie|shorts|underwear|boxers|briefs)\b.*\b(men'?s|male|guy'?s|man'?s|gentleman)\b/i,
      "Women's Clothing": /\b(women'?s|woman'?s|ladies|female|girl'?s)\b.*\b(dress|blouse|skirt|top|pants|jeans|jacket|sweater|leggings|bra|panties)\b|\b(dress|blouse|skirt|top|pants|jeans|jacket|sweater|leggings|bra|panties)\b.*\b(women'?s|woman'?s|ladies|female|girl'?s)\b/i,
      Shoes: /\b(shoe|sneaker|boot|sandal|heel|flat|loafer|oxford|running shoe|basketball shoe|tennis shoe|hiking boot|footwear|slipper|moccasin|pump|wedge|espadrille)\b/i,
      'Bags & Accessories': /\b(bag|handbag|purse|backpack|tote|clutch|wallet|belt|tie|scarf|hat|cap|beanie|glove|sunglasses|luggage|briefcase|messenger bag|crossbody|fanny pack)\b/i,
      Jewelry: /\b(jewelry|necklace|bracelet|earring|ring|pendant|chain|bangle|anklet|brooch|cufflink|jewel|gold|silver|diamond|gemstone)\b/i,
      Watches: /\b(watch|wristwatch|analog watch|digital watch|chronograph|timepiece)\b/i,
    },
  },
  home: {
    keywords: /\b(furniture|sofa|couch|chair|table|desk|bed|mattress|dresser|nightstand|bookshelf|cabinet|wardrobe|armchair|ottoman|recliner|dining|kitchen|cookware|pot|pan|knife|cutting board|blender|mixer|toaster|coffee maker|espresso|microwave|oven|stove|refrigerator|dishwasher|utensil|plate|bowl|cup|mug|glass|silverware|bedding|sheet|pillow|blanket|comforter|duvet|towel|bath|shower|curtain|rug|carpet|lamp|light|chandelier|sconce|decor|decoration|vase|frame|mirror|clock|plant|planter|garden|outdoor|patio|grill|lawn|mower|tool|storage|organizer|bin|basket|shelf|cleaning|vacuum|mop|broom|duster)\b/i,
    subcategories: {
      Furniture: /\b(furniture|sofa|couch|chair|table|desk|bed frame|mattress|dresser|nightstand|bookshelf|cabinet|wardrobe|armchair|ottoman|recliner|bench|stool|shelving unit|tv stand|coffee table|end table|dining table|office chair)\b/i,
      'Kitchen & Dining': /\b(kitchen|cookware|pot|pan|knife|cutting board|blender|mixer|toaster|coffee maker|espresso|microwave|air fryer|instant pot|slow cooker|utensil|plate|bowl|cup|mug|glass|silverware|dinnerware|bakeware|food processor|kettle|juicer)\b/i,
      'Bedding & Bath': /\b(bedding|sheet|pillow|blanket|comforter|duvet|towel|bath|shower|bathroom|mattress pad|mattress topper|pillow case|bed skirt|bath mat|shower curtain|bathrobe)\b/i,
      'Home Decor': /\b(decor|decoration|vase|frame|picture frame|mirror|clock|wall art|canvas|poster|sculpture|figurine|candle|artificial plant|decorative|ornament|tapestry)\b/i,
      'Garden & Outdoor': /\b(garden|outdoor|patio|grill|bbq|lawn|mower|plant|planter|pot|hose|sprinkler|rake|shovel|pruner|wheelbarrow|outdoor furniture|patio set|umbrella|fire pit|bird feeder)\b/i,
    },
  },
  beauty: {
    keywords: /\b(skincare|skin care|moisturizer|cleanser|serum|sunscreen|spf|face mask|facial|toner|eye cream|anti-aging|wrinkle|acne|lotion|cream|oil|body wash|soap|shampoo|conditioner|hair|haircare|hair care|styling|gel|mousse|spray|dryer|straightener|curler|makeup|cosmetic|foundation|concealer|mascara|lipstick|lip gloss|eyeshadow|eyeliner|blush|bronzer|highlighter|powder|primer|setting spray|brush|beauty blender|perfume|cologne|fragrance|eau de|deodorant|antiperspirant|razor|shaver|trimmer|grooming|toothbrush|toothpaste|mouthwash|floss|dental|oral care|vitamin|supplement|wellness|health)\b/i,
    subcategories: {
      Skincare: /\b(skincare|skin care|moisturizer|cleanser|serum|sunscreen|spf|face mask|facial|toner|eye cream|anti-aging|wrinkle|acne|face wash|exfoliant|retinol|hyaluronic|vitamin c serum|night cream|day cream)\b/i,
      Haircare: /\b(shampoo|conditioner|hair|haircare|hair care|styling|gel|mousse|hair spray|hair dryer|straightener|curler|flat iron|curling iron|hair mask|hair oil|hair serum|hair treatment|dandruff|scalp)\b/i,
      Makeup: /\b(makeup|cosmetic|foundation|concealer|mascara|lipstick|lip gloss|eyeshadow|eyeliner|blush|bronzer|highlighter|powder|primer|setting spray|brush|beauty blender|contour|brow|lip liner|nail polish)\b/i,
      Fragrances: /\b(perfume|cologne|fragrance|eau de parfum|eau de toilette|body mist|scent|aroma)\b/i,
      'Personal Care': /\b(deodorant|antiperspirant|body wash|soap|lotion|body cream|hand cream|foot cream|lip balm|hand sanitizer|feminine care|men's grooming)\b/i,
    },
  },
  sports: {
    keywords: /\b(sport|athletic|fitness|exercise|workout|gym|training|running|jogging|marathon|cycling|bike|bicycle|swimming|swim|yoga|pilates|weight|dumbbell|barbell|kettlebell|resistance band|treadmill|elliptical|stationary bike|rowing machine|exercise mat|foam roller|basketball|football|soccer|baseball|tennis|golf|hockey|volleyball|badminton|racket|ball|glove|helmet|pad|jersey|cleat|hiking|camping|tent|sleeping bag|backpack|climbing|fishing|hunting|kayak|surfing|skiing|snowboard|skateboard)\b/i,
    subcategories: {
      'Exercise & Fitness': /\b(fitness|exercise|workout|gym|training|weight|dumbbell|barbell|kettlebell|resistance band|treadmill|elliptical|stationary bike|rowing machine|exercise mat|foam roller|yoga mat|pull-up bar|bench press|home gym|fitness tracker)\b/i,
      'Outdoor Recreation': /\b(hiking|camping|tent|sleeping bag|backpack|climbing|outdoor|trail|trekking|mountaineering|compass|flashlight|lantern|camping stove|cooler|hammock|binoculars)\b/i,
      'Team Sports': /\b(basketball|football|soccer|baseball|softball|volleyball|hockey|lacrosse|rugby|cricket|team sport|jersey|uniform|goal|net|hoop)\b/i,
      Cycling: /\b(cycling|bike|bicycle|mountain bike|road bike|bmx|cycling helmet|bike lock|bike pump|cycling shorts|cycling jersey|pedal|handlebar)\b/i,
      Running: /\b(running|jogging|marathon|running shoe|running shorts|running watch|hydration|race|track|cross country)\b/i,
      Golf: /\b(golf|golf club|driver|putter|iron|wedge|golf ball|golf bag|golf cart|tee|golf glove|golf shoe)\b/i,
    },
  },
  food: {
    keywords: /\b(food|grocery|snack|chip|cookie|cracker|candy|chocolate|gum|mint|nut|dried fruit|granola|protein bar|energy bar|beverage|drink|water|soda|juice|tea|coffee|espresso|latte|energy drink|sports drink|milk|dairy|cheese|yogurt|butter|egg|meat|beef|chicken|pork|fish|seafood|vegetable|fruit|apple|banana|orange|berry|bread|pasta|rice|cereal|oatmeal|flour|sugar|salt|spice|sauce|condiment|oil|vinegar|organic|natural|vegan|gluten-free|keto|vitamin|supplement)\b/i,
    subcategories: {
      'Snacks & Candy': /\b(snack|chip|chips|cookie|cracker|candy|chocolate|gum|mint|nut|nuts|dried fruit|granola|protein bar|energy bar|popcorn|pretzel|trail mix|beef jerky|fruit snack)\b/i,
      Beverages: /\b(beverage|drink|water|soda|pop|juice|tea|coffee|espresso|latte|cappuccino|energy drink|sports drink|sparkling|carbonated|kombucha|smoothie|shake)\b/i,
      'Fresh Food': /\b(fresh|produce|vegetable|fruit|apple|banana|orange|berry|strawberry|blueberry|grape|melon|lettuce|tomato|potato|onion|carrot|broccoli|meat|beef|chicken|pork|fish|seafood|salmon|shrimp|egg|dairy|milk|cheese|yogurt|butter)\b/i,
    },
  },
  pets: {
    keywords: /\b(pet|dog|puppy|canine|cat|kitten|feline|bird|parrot|fish|aquarium|hamster|guinea pig|rabbit|reptile|pet food|dog food|cat food|treat|chew|toy|leash|collar|harness|crate|kennel|bed|bowl|feeder|litter|grooming|brush|shampoo|flea|tick|vaccine)\b/i,
    subcategories: {
      'Dog Supplies': /\b(dog|puppy|canine|dog food|dog treat|dog toy|dog bed|dog collar|dog leash|dog harness|dog crate|dog bowl|dog grooming)\b/i,
      'Cat Supplies': /\b(cat|kitten|feline|cat food|cat treat|cat toy|cat bed|cat collar|cat litter|litter box|scratching post|cat tree|cat grooming)\b/i,
      'Fish & Aquarium': /\b(fish|aquarium|tank|aquatic|fish food|fish tank|filter|pump|heater|decoration|gravel|substrate|freshwater|saltwater|tropical fish)\b/i,
    },
  },
  baby: {
    keywords: /\b(baby|infant|newborn|toddler|child|kid|stroller|car seat|carrier|crib|bassinet|nursery|diaper|wipe|formula|bottle|pacifier|teether|baby food|high chair|booster|potty|baby monitor|swing|bouncer|play mat|baby toy|onesie|bib|blanket|swaddle)\b/i,
    subcategories: {
      'Baby Gear': /\b(stroller|car seat|carrier|baby carrier|travel system|jogging stroller|umbrella stroller|convertible car seat|infant car seat)\b/i,
      'Baby Care': /\b(diaper|wipe|baby wipe|rash cream|baby lotion|baby shampoo|baby wash|baby powder|baby oil|nail clipper|thermometer|nasal aspirator)\b/i,
      Nursery: /\b(crib|bassinet|nursery|changing table|dresser|rocker|glider|mobile|nursery decor|baby bedding|crib sheet|mattress)\b/i,
      Feeding: /\b(formula|bottle|baby bottle|pacifier|teether|baby food|high chair|booster seat|sippy cup|bib|breast pump|nursing)\b/i,
    },
  },
  automotive: {
    keywords: /\b(car|auto|automotive|vehicle|truck|suv|motorcycle|motor|engine|tire|wheel|brake|oil|filter|battery|spark plug|headlight|taillight|wiper|mirror|seat cover|floor mat|steering wheel|dash|gps|navigation|car stereo|speaker|subwoofer|amplifier|car wash|wax|polish|detailing|tool|jack|wrench|socket|diagnostic)\b/i,
    subcategories: {
      'Car Electronics': /\b(car stereo|car audio|car speaker|subwoofer|amplifier|gps|navigation|dash cam|backup camera|bluetooth|car charger|car phone mount)\b/i,
      'Parts & Accessories': /\b(tire|wheel|brake|oil|filter|battery|spark plug|headlight|taillight|wiper|mirror|alternator|starter|radiator|belt|hose|gasket)\b/i,
      'Car Care': /\b(car wash|wax|polish|detailing|cleaner|protectant|air freshener|car vacuum|microfiber|clay bar|buffer|polisher)\b/i,
    },
  },
  toys: {
    keywords: /\b(toy|game|play|lego|block|building|puzzle|doll|barbie|action figure|stuffed animal|plush|teddy bear|rc|remote control|drone|robot|board game|card game|video game|playstation|xbox|nintendo|educational|stem|science kit|art|craft|crayola|play-doh|nerf|hot wheels|train set|playset)\b/i,
    subcategories: {
      'Building Toys': /\b(lego|block|building|construction|mega bloks|k'nex|magnetic tiles|lincoln logs|erector set)\b/i,
      'Dolls & Stuffed Animals': /\b(doll|barbie|stuffed animal|plush|teddy bear|american girl|baby doll|fashion doll|soft toy|beanie)\b/i,
      'Action Figures': /\b(action figure|superhero|marvel|dc|star wars|transformers|gi joe|power rangers|collectible figure)\b/i,
      'Board Games': /\b(board game|card game|puzzle|monopoly|scrabble|chess|checkers|uno|playing cards|jigsaw puzzle|strategy game)\b/i,
      'Remote Control': /\b(rc|remote control|drone|robot|rc car|rc truck|rc plane|rc helicopter|quadcopter)\b/i,
      'Educational Toys': /\b(educational|stem|science kit|learning|alphabet|numbers|coding|microscope|telescope|chemistry set)\b/i,
    },
  },
};

/**
 * Finds the best matching category for a product based on its name and description
 */
function findMatchingCategory(
  productName: string,
  productDescription: string,
  categories: CategoryInfo[]
): CategoryInfo {
  const text = `${productName} ${productDescription}`.toLowerCase();

  // Score each category group
  const groupScores: Record<string, number> = {};
  let bestGroup = '';
  let bestGroupScore = 0;

  for (const [group, config] of Object.entries(CATEGORY_KEYWORDS)) {
    const matches = text.match(config.keywords);
    const score = matches ? matches.length : 0;
    groupScores[group] = score;
    if (score > bestGroupScore) {
      bestGroupScore = score;
      bestGroup = group;
    }
  }

  // If no strong match, return a random category
  if (bestGroupScore === 0) {
    return randomElement(categories);
  }

  // Find matching subcategory within the best group
  const groupConfig = CATEGORY_KEYWORDS[bestGroup];
  let bestSubcategory = '';
  let bestSubScore = 0;

  if (groupConfig.subcategories) {
    for (const [subName, subRegex] of Object.entries(groupConfig.subcategories)) {
      const subMatches = text.match(subRegex);
      const subScore = subMatches ? subMatches.length : 0;
      if (subScore > bestSubScore) {
        bestSubScore = subScore;
        bestSubcategory = subName;
      }
    }
  }

  // Find the category in our list
  if (bestSubcategory) {
    const exactMatch = categories.find(c => c.name === bestSubcategory);
    if (exactMatch) return exactMatch;
  }

  // Fall back to any category in the matching group
  const groupCategories = categories.filter(c => c.group === bestGroup);
  if (groupCategories.length > 0) {
    return randomElement(groupCategories);
  }

  // Last resort: random category
  return randomElement(categories);
}

// Real product images from dummyjson.com CDN - mapped to our categories
const CATEGORY_PRODUCT_IMAGES: Record<string, string[]> = {
  electronics: [
    'https://cdn.dummyjson.com/product-images/laptops/apple-macbook-pro-14-inch-space-grey/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/laptops/asus-zenbook-pro-dual-screen-laptop/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/smartphones/iphone-13-pro/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/smartphones/samsung-galaxy-s21-5g/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tablets/ipad-mini-2021-starlight/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tablets/samsung-galaxy-tab-s8-plus-grey/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods-max-silver/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/laptops/huawei-matebook-x-pro/thumbnail.webp',
  ],
  clothing: [
    'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mens-shirts/gigabyte-aorus-men-tshirt/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mens-shirts/man-plaid-shirt/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mens-shoes/nike-air-jordan-1-red-and-black/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mens-shoes/puma-future-rider-trainers/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tops/girl-summer-dress/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/womens-dresses/black-women\'s-gown/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/womens-shoes/calvin-klein-heel-shoes/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sunglasses/black-sun-glasses/thumbnail.webp',
  ],
  home: [
    'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-bed/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/bedside-table-african-cherry/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/decoration-swing/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/family-tree-photo-frame/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/house-showpiece-plant/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/bamboo-spatula/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/black-whisk/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/ceramic-knife/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/cooking-pot/thumbnail.webp',
  ],
  beauty: [
    'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/beauty/eyeshadow-palette-with-mirror/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/beauty/powder-canister/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/beauty/red-nail-polish/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/fragrances/calvin-klein-ck-one/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/fragrances/chanel-coco-noir-eau-de/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/skin-care/attitude-super-leaves-hand-soap/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/skin-care/olay-ultra-moisture-shea-butter-body-wash/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/skin-care/vaseline-men-body-and-face-lotion/thumbnail.webp',
  ],
  sports: [
    'https://cdn.dummyjson.com/product-images/sports-accessories/american-football/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/baseball-ball/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/baseball-glove/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/basketball/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/cricket-bat/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/cricket-helmet/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/golf-ball/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/tennis-ball/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/tennis-racket/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/volleyball/thumbnail.webp',
  ],
  toys: [
    'https://cdn.dummyjson.com/product-images/sports-accessories/football/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/basketball/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/baseball-glove/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mobile-accessories/amazon-echo-plus/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/wooden-bathroom-sink/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/decoration-swing/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/black-aluminium-cup/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/glass-carafe/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/family-tree-photo-frame/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/tennis-ball/thumbnail.webp',
  ],
  automotive: [
    'https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/vehicle/dodge-hornet-gt-plus/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/motorcycle/generic-motorcycle/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/motorcycle/kawasaki-z800/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/vehicle/300-touring/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/vehicle/charger-sxt-rwd/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/motorcycle/motogp-ci.h1/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/vehicle/dodge-hornet-gt-plus/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/motorcycle/kawasaki-z800/thumbnail.webp',
  ],
  pets: [
    'https://cdn.dummyjson.com/product-images/groceries/cat-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/dog-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/cat-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/dog-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/cat-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/dog-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/cat-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/dog-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/cat-food/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/dog-food/thumbnail.webp',
  ],
  baby: [
    'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tops/girl-summer-dress/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-bed/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/house-showpiece-plant/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/glass-carafe/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/bedside-table-african-cherry/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/family-tree-photo-frame/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/tops/sleeves-printed-top/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/wooden-bathroom-sink/thumbnail.webp',
  ],
  food: [
    'https://cdn.dummyjson.com/product-images/groceries/apple/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/beef-steak/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/chicken-meat/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/cooking-oil/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/cucumber/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/eggs/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/fish-steak/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/green-bell-pepper/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/green-chilli-pepper/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/honey-jar/thumbnail.webp',
  ],
  default: [
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/bamboo-spatula/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/kitchen-accessories/black-aluminium-cup/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/decoration-swing/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/home-decoration/family-tree-photo-frame/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/furniture/annibale-colombo-sofa/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/mobile-accessories/apple-airpods/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/groceries/apple/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sports-accessories/basketball/thumbnail.webp',
    'https://cdn.dummyjson.com/product-images/sunglasses/black-sun-glasses/thumbnail.webp',
  ],
};

// Simple hash function for consistent image per SKU
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}


// ============================================================================
// DATA LOADING
// ============================================================================
interface ProductTemplate {
  name: string;
  description: string;
  brand: string;
  price: number;
}

function loadRealProductData(): ProductTemplate[] {
  const templates: ProductTemplate[] = [];

  // Load Amazon data
  const amazonPath = path.join(DATA_DIR, 'amazon-products.csv');
  if (fs.existsSync(amazonPath)) {
    try {
      const content = fs.readFileSync(amazonPath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }) as Record<string, string>[];
      for (const row of records) {
        if (row.title && row.title.length > 10) {
          templates.push({
            name: row.title.substring(0, 150),
            description: (row.description || row.title).substring(0, 400),
            brand: row.brand || '',
            price: parseFloat(String(row.final_price || '0').replace(/[^0-9.]/g, '')) || 0,
          });
        }
      }
    } catch (e) {
      console.log('   Warning: Could not parse Amazon data');
    }
  }

  // Load Walmart data
  const walmartPath = path.join(DATA_DIR, 'walmart-products.csv');
  if (fs.existsSync(walmartPath)) {
    try {
      const content = fs.readFileSync(walmartPath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true, relax_column_count: true }) as Record<string, string>[];
      for (const row of records) {
        if (row.product_name && row.product_name.length > 10) {
          templates.push({
            name: row.product_name.substring(0, 150),
            description: (row.description || row.product_name).substring(0, 400),
            brand: row.brand || '',
            price: parseFloat(String(row.final_price || '0').replace(/[^0-9.]/g, '')) || 0,
          });
        }
      }
    } catch (e) {
      console.log('   Warning: Could not parse Walmart data');
    }
  }

  return templates;
}

// ============================================================================
// CATEGORY SEEDING
// ============================================================================
interface CategoryInfo {
  id: string;
  name: string;
  group: string;
}

async function seedCategories(): Promise<CategoryInfo[]> {
  console.log('Seeding categories...');

  const categories: CategoryInfo[] = [];

  for (const [parentName, data] of Object.entries(CATEGORY_HIERARCHY)) {
    const parentSlug = slugify(parentName);

    const parent = await prisma.category.upsert({
      where: { slug: parentSlug },
      update: {},
      create: {
        name: parentName,
        description: data.description,
        slug: parentSlug,
        isActive: true,
      },
    });

    for (const [childName, childDesc] of Object.entries(data.children)) {
      const childSlug = slugify(childName);

      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: {},
        create: {
          name: childName,
          description: childDesc,
          slug: childSlug,
          parentId: parent.id,
          isActive: true,
        },
      });
      categories.push({
        id: child.id,
        name: childName,
        group: getCategoryGroup(childName),
      });
    }
  }

  console.log(`   Created ${categories.length} subcategories`);
  return categories;
}

// ============================================================================
// MAIN SEEDING LOGIC
// ============================================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ShopSphere Million-Record Database Seeder');
  console.log(`  Target: ${TARGET_PRODUCTS.toLocaleString()} products`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalStart = Date.now();

  try {
    console.log('Clearing existing data...');
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    console.log('   Database cleared\n');

    // Seed categories
    const categories = await seedCategories();

    // Load real product templates
    console.log('\n📚 Loading real product data as templates...');
    const templates = loadRealProductData();
    console.log(`   ✓ Loaded ${templates.length} templates\n`);

    console.log(`Generating ${TARGET_PRODUCTS.toLocaleString()} products...`);
    console.log(`   Batch size: ${BATCH_SIZE.toLocaleString()}`);
    console.log('');

    let created = 0;
    const startTime = Date.now();

    while (created < TARGET_PRODUCTS) {
      const batchSize = Math.min(BATCH_SIZE, TARGET_PRODUCTS - created);
      const products: Prisma.ProductCreateManyInput[] = [];

      for (let i = 0; i < batchSize; i++) {
        const index = created + i;

        // Decide whether to use template or generate
        const useTemplate = templates.length > 0 && Math.random() < 0.35;
        const template = useTemplate ? randomElement(templates) : null;

        // Generate name and find matching category
        let name: string;
        let description: string;
        let brand: string;
        let category: CategoryInfo;

        if (template && template.name) {
          // Use template - find matching category based on product content
          const suffix = Math.random() < 0.5 ? ` - ${randomElement(['V2', 'Gen 2', 'Plus', 'Pro', 'Max', 'Lite', '2024', 'SE', 'X'])}` : '';
          name = template.name + suffix;
          description = template.description || template.name;

          // Smart category matching based on product name/description
          category = findMatchingCategory(template.name, description, categories);
          const group = category.group;
          brand = template.brand || randomElement(BRANDS[group] || BRANDS.default);
        } else {
          // Generate product - pick category first, then generate matching product
          category = randomElement(categories);
          const group = category.group;
          brand = randomElement(BRANDS[group] || BRANDS.default);
          const adj = randomElement(adjectives);
          const type = randomElement(productTypes[group] || productTypes.default);
          name = `${brand} ${adj} ${type}`;
          description = `${name} - High quality product from ${brand}. Features premium design and exceptional performance. Perfect for everyday use.`;
        }

        const group = category.group;

        // Ensure name is unique enough
        name = name.substring(0, 200);
        const slugBase = slugify(name);
        const slug = `${slugBase}-${index}`;
        const sku = `${group.substring(0, 3).toUpperCase()}${Math.floor(index / 10000).toString(36).toUpperCase()}${(index % 10000).toString().padStart(4, '0')}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

        // Price
        let price: number;
        if (template?.price && template.price > 0) {
          price = Math.round(template.price * (0.8 + Math.random() * 0.4) * 100) / 100;
        } else {
          price = randomPrice();
        }

        const hasDiscount = Math.random() < 0.25;
        const comparePrice = hasDiscount ? Math.round(price * (1.1 + Math.random() * 0.4) * 100) / 100 : null;

        // Tags
        const tags = [brand, category.name];
        if (Math.random() < 0.5) tags.push(randomElement(adjectives));

        products.push({
          name,
          description: description.substring(0, 1000),
          sku,
          slug,
          price: new Prisma.Decimal(price),
          comparePrice: comparePrice ? new Prisma.Decimal(comparePrice) : null,
          categoryId: category.id,
          brand,
          images: (() => {
            const images = CATEGORY_PRODUCT_IMAGES[group] || CATEGORY_PRODUCT_IMAGES.default;
            const idx1 = hashCode(sku) % images.length;
            const idx2 = hashCode(sku + 'b') % images.length;
            return [images[idx1], images[idx2]];
          })(),
          inventory: Math.floor(Math.random() * 1000),
          lowStockThreshold: [5, 10, 15, 20, 25][Math.floor(Math.random() * 5)],
          isActive: Math.random() > 0.03,
          isFeatured: Math.random() < 0.02,
          tags: [...new Set(tags)].slice(0, 5),
          attributes: {
            rating: Math.round((1 + Math.random() * 4) * 10) / 10,
            reviewCount: Math.floor(Math.random() * 5000),
            weight: Math.round((0.1 + Math.random() * 20) * 100) / 100,
          },
        });
      }

      await prisma.product.createMany({
        data: products,
        skipDuplicates: true,
      });

      created += batchSize;

      if (created % PROGRESS_INTERVAL === 0 || created === TARGET_PRODUCTS) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = Math.round(created / elapsed);
        const eta = Math.round((TARGET_PRODUCTS - created) / rate);
        const percent = Math.round((created / TARGET_PRODUCTS) * 100);
        console.log(`   → ${created.toLocaleString()} / ${TARGET_PRODUCTS.toLocaleString()} (${percent}%) | ${rate.toLocaleString()}/sec | ETA: ${eta}s`);
      }
    }

    // Summary
    const totalElapsed = (Date.now() - totalStart) / 1000;
    const finalCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    const featuredCount = await prisma.product.count({ where: { isFeatured: true } });
    const activeCount = await prisma.product.count({ where: { isActive: true } });
    const avgPrice = await prisma.product.aggregate({ _avg: { price: true } });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SEEDING COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Products:     ${finalCount.toLocaleString()}`);
    console.log(`  Active Products:    ${activeCount.toLocaleString()}`);
    console.log(`  Featured Products:  ${featuredCount.toLocaleString()}`);
    console.log(`  Categories:         ${categoryCount}`);
    console.log(`  Average Price:      $${Number(avgPrice._avg.price).toFixed(2)}`);
    console.log(`  Total Time:         ${totalElapsed.toFixed(1)}s`);
    console.log(`  Insert Rate:        ${Math.round(finalCount / totalElapsed).toLocaleString()}/sec`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
