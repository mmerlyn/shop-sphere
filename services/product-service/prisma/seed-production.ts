import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// Data directory
const DATA_DIR = fs.existsSync('/app/data')
  ? '/app/data'
  : path.join(__dirname, '../../../data');

// ============================================================================
// CATEGORY HIERARCHY - Production-ready structure
// ============================================================================
const CATEGORY_HIERARCHY = {
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
    },
  },
  'Clothing & Fashion': {
    description: 'Apparel, shoes, and fashion accessories',
    children: {
      "Men's Clothing": "Men's shirts, pants, jackets, and more",
      "Women's Clothing": "Women's dresses, tops, bottoms, and more",
      Shoes: 'Footwear for all occasions',
      'Bags & Accessories': 'Handbags, wallets, belts, and accessories',
      Jewelry: 'Fine and fashion jewelry',
      Watches: 'Analog, digital, and smart watches',
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
    },
  },
  'Office & School': {
    description: 'Office supplies and school essentials',
    children: {
      'Office Supplies': 'Stationery, paper, and desk accessories',
      'Office Furniture': 'Desks, chairs, and storage',
      'School Supplies': 'Notebooks, backpacks, and study aids',
      'Printers & Ink': 'Printers, scanners, and supplies',
    },
  },
  Automotive: {
    description: 'Auto parts, accessories, and tools',
    children: {
      'Car Electronics': 'Audio, GPS, and car gadgets',
      'Interior Accessories': 'Seat covers, mats, and organizers',
      'Exterior Accessories': 'Car covers, lights, and decals',
      'Tools & Equipment': 'Auto repair and maintenance tools',
    },
  },
  'Pet Supplies': {
    description: 'Products for pets',
    children: {
      'Dog Supplies': 'Food, toys, and accessories for dogs',
      'Cat Supplies': 'Food, toys, and accessories for cats',
      'Fish & Aquarium': 'Aquarium supplies and fish food',
      'Bird Supplies': 'Bird cages, food, and accessories',
    },
  },
  'Baby & Kids': {
    description: 'Products for babies and children',
    children: {
      'Baby Gear': 'Strollers, car seats, and carriers',
      'Baby Care': 'Diapers, wipes, and baby essentials',
      "Kids' Clothing": 'Clothing for children',
      "Kids' Toys": 'Age-appropriate toys and games',
    },
  },
};

// ============================================================================
// UTILITIES
// ============================================================================
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
    .substring(0, 100);
}

function generateSKU(brand: string, index: number): string {
  const prefix = (brand || 'PRD').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X') || 'PRD';
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  const random = faker.string.alphanumeric(4).toUpperCase();
  return `${prefix}-${timestamp}${random}-${index.toString().padStart(5, '0')}`;
}

function parsePrice(priceStr: string | number | undefined): number | null {
  if (priceStr === undefined || priceStr === null || priceStr === '') return null;
  if (typeof priceStr === 'number') return priceStr;
  const cleaned = priceStr.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function parseImages(imageData: string | undefined): string[] {
  if (!imageData) return [];

  // Try to parse as JSON array
  try {
    const parsed = JSON.parse(imageData);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((url: string) => typeof url === 'string' && url.startsWith('http'))
        .slice(0, 6);
    }
  } catch {
    // Not JSON, try comma/pipe separated
  }

  return imageData
    .split(/[,|]/)
    .map((url) => url.trim())
    .filter((url) => url.startsWith('http'))
    .slice(0, 6);
}

function cleanDescription(desc: string | undefined): string {
  if (!desc) return '';
  // Remove HTML tags and excessive whitespace
  return desc
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 2000);
}

// ============================================================================
// CATEGORY MAPPING
// ============================================================================
function mapToCategory(
  text: string,
  categoryMap: Map<string, { id: string; parentId: string | null }>
): string {
  const lower = text.toLowerCase();

  // Electronics subcategories
  if (/\b(phone|smartphone|iphone|samsung galaxy|mobile|cellular)\b/.test(lower))
    return categoryMap.get('mobile phones')?.id || categoryMap.get('electronics')!.id;
  if (/\b(laptop|computer|pc|desktop|macbook|chromebook)\b/.test(lower))
    return categoryMap.get('computers & laptops')?.id || categoryMap.get('electronics')!.id;
  if (/\b(headphone|earphone|earbud|speaker|audio|airpod|soundbar)\b/.test(lower))
    return categoryMap.get('audio & headphones')?.id || categoryMap.get('electronics')!.id;
  if (/\b(camera|lens|photography|tripod|dslr|mirrorless)\b/.test(lower))
    return categoryMap.get('cameras & photography')?.id || categoryMap.get('electronics')!.id;
  if (/\b(tv|television|monitor|projector|streaming|roku|firestick)\b/.test(lower))
    return categoryMap.get('tv & home theater')?.id || categoryMap.get('electronics')!.id;
  if (/\b(gaming|playstation|xbox|nintendo|console|controller)\b/.test(lower))
    return categoryMap.get('gaming')?.id || categoryMap.get('electronics')!.id;
  if (/\b(smartwatch|fitness tracker|wearable|apple watch|fitbit)\b/.test(lower))
    return categoryMap.get('wearables')?.id || categoryMap.get('electronics')!.id;
  if (/\b(tablet|ipad|kindle)\b/.test(lower))
    return categoryMap.get('electronics')!.id;

  // Home & Garden
  if (/\b(sofa|couch|table|chair|desk|furniture|bookshelf)\b/.test(lower))
    return categoryMap.get('furniture')?.id || categoryMap.get('home & garden')!.id;
  if (/\b(kitchen|cookware|pot|pan|blender|mixer|knife|utensil)\b/.test(lower))
    return categoryMap.get('kitchen & dining')?.id || categoryMap.get('home & garden')!.id;
  if (/\b(bed|mattress|pillow|sheet|towel|bathroom)\b/.test(lower))
    return categoryMap.get('bedding & bath')?.id || categoryMap.get('home & garden')!.id;
  if (/\b(decor|lamp|light|art|picture|frame|candle|vase)\b/.test(lower))
    return categoryMap.get('home decor')?.id || categoryMap.get('home & garden')!.id;
  if (/\b(garden|outdoor|patio|grill|lawn|plant|tool)\b/.test(lower))
    return categoryMap.get('garden & outdoor')?.id || categoryMap.get('home & garden')!.id;

  // Fashion
  if (/\b(shirt|pants|jacket|coat|hoodie|sweater|jeans)\b/.test(lower)) {
    if (/\b(women|woman|lady|girl)\b/.test(lower))
      return categoryMap.get("women's clothing")?.id || categoryMap.get('clothing & fashion')!.id;
    return categoryMap.get("men's clothing")?.id || categoryMap.get('clothing & fashion')!.id;
  }
  if (/\b(dress|blouse|skirt|legging)\b/.test(lower))
    return categoryMap.get("women's clothing")?.id || categoryMap.get('clothing & fashion')!.id;
  if (/\b(shoe|sneaker|boot|sandal|heel|loafer)\b/.test(lower))
    return categoryMap.get('shoes')?.id || categoryMap.get('clothing & fashion')!.id;
  if (/\b(bag|purse|wallet|backpack|handbag|belt)\b/.test(lower))
    return categoryMap.get('bags & accessories')?.id || categoryMap.get('clothing & fashion')!.id;
  if (/\b(watch|timepiece)\b/.test(lower))
    return categoryMap.get('watches')?.id || categoryMap.get('clothing & fashion')!.id;
  if (/\b(jewelry|necklace|bracelet|earring|ring)\b/.test(lower))
    return categoryMap.get('jewelry')?.id || categoryMap.get('clothing & fashion')!.id;

  // Health & Beauty
  if (/\b(skincare|moisturizer|serum|facial|cleanser|sunscreen)\b/.test(lower))
    return categoryMap.get('skincare')?.id || categoryMap.get('health & beauty')!.id;
  if (/\b(shampoo|conditioner|hair|styling)\b/.test(lower))
    return categoryMap.get('haircare')?.id || categoryMap.get('health & beauty')!.id;
  if (/\b(makeup|lipstick|mascara|foundation|eyeshadow|cosmetic)\b/.test(lower))
    return categoryMap.get('makeup')?.id || categoryMap.get('health & beauty')!.id;
  if (/\b(perfume|cologne|fragrance)\b/.test(lower))
    return categoryMap.get('fragrances')?.id || categoryMap.get('health & beauty')!.id;
  if (/\b(vitamin|supplement|health|wellness|protein)\b/.test(lower))
    return categoryMap.get('health & wellness')?.id || categoryMap.get('health & beauty')!.id;
  if (/\b(toothbrush|razor|deodorant|soap|body wash)\b/.test(lower))
    return categoryMap.get('personal care')?.id || categoryMap.get('health & beauty')!.id;

  // Sports & Outdoors
  if (/\b(gym|fitness|exercise|yoga|dumbbell|treadmill|workout)\b/.test(lower))
    return categoryMap.get('exercise & fitness')?.id || categoryMap.get('sports & outdoors')!.id;
  if (/\b(camping|hiking|tent|sleeping bag|backpack outdoor)\b/.test(lower))
    return categoryMap.get('outdoor recreation')?.id || categoryMap.get('sports & outdoors')!.id;
  if (/\b(bike|bicycle|cycling|helmet)\b/.test(lower))
    return categoryMap.get('cycling')?.id || categoryMap.get('sports & outdoors')!.id;
  if (/\b(basketball|football|soccer|baseball|tennis)\b/.test(lower))
    return categoryMap.get('team sports')?.id || categoryMap.get('sports & outdoors')!.id;

  // Toys & Games
  if (/\b(lego|building block|construction)\b/.test(lower))
    return categoryMap.get('building toys')?.id || categoryMap.get('toys & games')!.id;
  if (/\b(board game|puzzle|card game)\b/.test(lower))
    return categoryMap.get('board games')?.id || categoryMap.get('toys & games')!.id;
  if (/\b(action figure|collectible)\b/.test(lower))
    return categoryMap.get('action figures')?.id || categoryMap.get('toys & games')!.id;
  if (/\b(doll|plush|stuffed)\b/.test(lower))
    return categoryMap.get('dolls & stuffed animals')?.id || categoryMap.get('toys & games')!.id;
  if (/\b(toy)\b/.test(lower))
    return categoryMap.get('toys & games')!.id;

  // Office & School
  if (/\b(office|desk|chair office|organizer)\b/.test(lower))
    return categoryMap.get('office supplies')?.id || categoryMap.get('office & school')!.id;
  if (/\b(printer|ink|scanner)\b/.test(lower))
    return categoryMap.get('printers & ink')?.id || categoryMap.get('office & school')!.id;
  if (/\b(notebook|pen|pencil|school|backpack)\b/.test(lower))
    return categoryMap.get('school supplies')?.id || categoryMap.get('office & school')!.id;

  // Automotive
  if (/\b(car|auto|vehicle|motor)\b/.test(lower))
    return categoryMap.get('automotive')!.id;

  // Pet Supplies
  if (/\b(dog|puppy|canine)\b/.test(lower))
    return categoryMap.get('dog supplies')?.id || categoryMap.get('pet supplies')!.id;
  if (/\b(cat|kitten|feline)\b/.test(lower))
    return categoryMap.get('cat supplies')?.id || categoryMap.get('pet supplies')!.id;
  if (/\b(pet|animal)\b/.test(lower))
    return categoryMap.get('pet supplies')!.id;

  // Baby & Kids
  if (/\b(baby|infant|toddler|diaper|stroller)\b/.test(lower))
    return categoryMap.get('baby gear')?.id || categoryMap.get('baby & kids')!.id;
  if (/\b(kid|child|children)\b/.test(lower))
    return categoryMap.get('baby & kids')!.id;

  // Default to Electronics for unmatched (since most data is electronics)
  return categoryMap.get('electronics')!.id;
}

// ============================================================================
// DATABASE SEEDING
// ============================================================================
async function seedCategories(): Promise<Map<string, { id: string; parentId: string | null }>> {
  console.log('Seeding categories...');

  const categoryMap = new Map<string, { id: string; parentId: string | null }>();

  for (const [parentName, data] of Object.entries(CATEGORY_HIERARCHY)) {
    const parentSlug = slugify(parentName);

    // Create parent category
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
    categoryMap.set(parentName.toLowerCase(), { id: parent.id, parentId: null });

    // Create child categories
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
      categoryMap.set(childName.toLowerCase(), { id: child.id, parentId: parent.id });
    }
  }

  console.log(`   Created ${categoryMap.size} categories with hierarchy`);
  return categoryMap;
}

interface ProductInput {
  name: string;
  description: string;
  brand: string | null;
  price: number;
  comparePrice: number | null;
  images: string[];
  categoryId: string;
  tags: string[];
  rating: number | null;
  reviewCount: number | null;
  sku?: string;
}

// CSV record types
interface AmazonRecord {
  title?: string;
  brand?: string;
  description?: string;
  initial_price?: string;
  final_price?: string;
  images?: string;
  image_url?: string;
  categories?: string;
  department?: string;
  root_bs_category?: string;
  asin?: string;
  rating?: string;
  reviews_count?: string;
  [key: string]: string | undefined;
}

interface WalmartRecord {
  product_name?: string;
  brand?: string;
  description?: string;
  initial_price?: string;
  final_price?: string;
  image_urls?: string;
  main_image?: string;
  sku?: string;
  product_id?: string;
  category_name?: string;
  category_path?: string;
  breadcrumbs?: string;
  tags?: string;
  rating?: string;
  rating_stars?: string;
  review_count?: string;
  available_for_delivery?: string;
  available_for_pickup?: string;
  colors?: string;
  sizes?: string;
  [key: string]: string | undefined;
}

async function processAmazonData(
  categoryMap: Map<string, { id: string; parentId: string | null }>,
  existingSlugs: Set<string>,
  existingSKUs: Set<string>
): Promise<number> {
  const filePath = path.join(DATA_DIR, 'amazon-products.csv');
  if (!fs.existsSync(filePath)) {
    console.log('   Amazon data file not found, skipping...');
    return 0;
  }

  console.log('Processing Amazon products...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true }) as AmazonRecord[];

  let count = 0;
  const products: any[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const name = row.title?.trim();
    if (!name || name.length < 3) continue;

    // Generate unique slug
    let slug = slugify(name);
    let slugCounter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(name).substring(0, 90)}-${slugCounter++}`;
    }
    existingSlugs.add(slug);

    // Generate unique SKU
    let sku = row.asin || generateSKU(row.brand || 'AMZ', count);
    while (existingSKUs.has(sku)) {
      sku = generateSKU(row.brand || 'AMZ', count + Math.floor(Math.random() * 10000));
    }
    existingSKUs.add(sku);

    // Parse prices
    const finalPrice = parsePrice(row.final_price);
    const initialPrice = parsePrice(row.initial_price);
    const price = finalPrice || initialPrice || faker.number.float({ min: 9.99, max: 499.99, fractionDigits: 2 });
    const comparePrice = initialPrice && initialPrice > price ? initialPrice : null;

    // Parse images
    let images = parseImages(row.images) || parseImages(row.image_url);
    if (images.length === 0) {
      // Generate placeholder images using picsum
      images = [
        `https://picsum.photos/seed/${sku}/800/800`,
        `https://picsum.photos/seed/${sku}1/800/800`,
      ];
    }

    // Map category
    const categoryText = `${name} ${row.categories || ''} ${row.department || ''}`;
    const categoryId = mapToCategory(categoryText, categoryMap);

    // Build tags
    const tags: string[] = [];
    if (row.brand) tags.push(row.brand);
    if (row.department) tags.push(row.department);
    if (row.root_bs_category) tags.push(row.root_bs_category);

    // Parse rating
    const rating = row.rating ? parseFloat(row.rating) : null;
    const reviewCount = row.reviews_count ? parseInt(row.reviews_count, 10) : 0;

    products.push({
      name: name.substring(0, 255),
      description: cleanDescription(row.description) || `${name}. Quality product available at ShopSphere.`,
      sku,
      slug,
      price,
      comparePrice,
      categoryId,
      brand: row.brand?.substring(0, 100) || null,
      images,
      inventory: faker.number.int({ min: 0, max: 500 }),
      lowStockThreshold: faker.helpers.arrayElement([5, 10, 15, 20]),
      isActive: true,
      isFeatured: faker.datatype.boolean({ probability: 0.05 }),
      tags: Array.from(new Set(tags.filter(Boolean).map((t) => t.substring(0, 50)))).slice(0, 10),
      attributes: rating
        ? {
            rating,
            reviewCount,
            source: 'Amazon',
          }
        : { source: 'Amazon' },
    });

    if (products.length >= 100) {
      await prisma.product.createMany({ data: products, skipDuplicates: true });
      count += products.length;
      console.log(`   → Inserted ${count} Amazon products...`);
      products.length = 0;
    }
  }

  if (products.length > 0) {
    await prisma.product.createMany({ data: products, skipDuplicates: true });
    count += products.length;
  }

  console.log(`   Completed Amazon: ${count} products`);
  return count;
}

async function processWalmartData(
  categoryMap: Map<string, { id: string; parentId: string | null }>,
  existingSlugs: Set<string>,
  existingSKUs: Set<string>
): Promise<number> {
  const filePath = path.join(DATA_DIR, 'walmart-products.csv');
  if (!fs.existsSync(filePath)) {
    console.log('   Walmart data file not found, skipping...');
    return 0;
  }

  console.log('Processing Walmart products...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true }) as WalmartRecord[];

  let count = 0;
  const products: any[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const name = row.product_name?.trim();
    if (!name || name.length < 3) continue;

    // Generate unique slug
    let slug = slugify(name);
    let slugCounter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(name).substring(0, 90)}-${slugCounter++}`;
    }
    existingSlugs.add(slug);

    // Generate unique SKU
    let sku = row.sku || row.product_id || generateSKU(row.brand || 'WMT', count);
    while (existingSKUs.has(sku)) {
      sku = generateSKU(row.brand || 'WMT', count + Math.floor(Math.random() * 10000));
    }
    existingSKUs.add(sku);

    // Parse prices
    const finalPrice = parsePrice(row.final_price);
    const initialPrice = parsePrice(row.initial_price);
    const price = finalPrice || initialPrice || faker.number.float({ min: 9.99, max: 499.99, fractionDigits: 2 });
    const comparePrice = initialPrice && initialPrice > price ? initialPrice : null;

    // Parse images
    let images = parseImages(row.image_urls);
    if (images.length === 0 && row.main_image) {
      images = [row.main_image];
    }
    if (images.length === 0) {
      images = [
        `https://picsum.photos/seed/${sku}/800/800`,
        `https://picsum.photos/seed/${sku}1/800/800`,
      ];
    }

    // Map category
    const categoryText = `${name} ${row.category_name || ''} ${row.category_path || ''} ${row.breadcrumbs || ''}`;
    const categoryId = mapToCategory(categoryText, categoryMap);

    // Build tags
    const tags: string[] = [];
    if (row.brand) tags.push(row.brand);
    if (row.category_name) tags.push(row.category_name);
    if (row.tags) {
      try {
        const parsed = JSON.parse(row.tags);
        if (Array.isArray(parsed)) tags.push(...parsed);
      } catch {
        tags.push(row.tags);
      }
    }

    // Parse rating
    const rating = row.rating ? parseFloat(row.rating) : (row.rating_stars ? parseFloat(row.rating_stars) : null);
    const reviewCount = row.review_count ? parseInt(row.review_count, 10) : 0;

    // Check availability
    const isAvailable = row.available_for_delivery === 'true' || row.available_for_pickup === 'true';

    products.push({
      name: name.substring(0, 255),
      description: cleanDescription(row.description) || `${name}. Quality product available at ShopSphere.`,
      sku,
      slug,
      price,
      comparePrice,
      categoryId,
      brand: row.brand?.substring(0, 100) || null,
      images,
      inventory: isAvailable ? faker.number.int({ min: 10, max: 500 }) : faker.number.int({ min: 0, max: 5 }),
      lowStockThreshold: faker.helpers.arrayElement([5, 10, 15, 20]),
      isActive: true,
      isFeatured: faker.datatype.boolean({ probability: 0.05 }),
      tags: Array.from(new Set(tags.filter(Boolean).map((t) => String(t).substring(0, 50)))).slice(0, 10),
      attributes: rating
        ? {
            rating,
            reviewCount,
            source: 'Walmart',
            colors: row.colors || null,
            sizes: row.sizes || null,
          }
        : { source: 'Walmart' },
    });

    if (products.length >= 100) {
      await prisma.product.createMany({ data: products, skipDuplicates: true });
      count += products.length;
      console.log(`   → Inserted ${count} Walmart products...`);
      products.length = 0;
    }
  }

  if (products.length > 0) {
    await prisma.product.createMany({ data: products, skipDuplicates: true });
    count += products.length;
  }

  console.log(`   Completed Walmart: ${count} products`);
  return count;
}

async function generateSyntheticProducts(
  categoryMap: Map<string, { id: string; parentId: string | null }>,
  existingSlugs: Set<string>,
  existingSKUs: Set<string>,
  count: number = 500
): Promise<number> {
  console.log(`Generating ${count} synthetic products with Faker...`);

  const products: any[] = [];
  let inserted = 0;

  // Get all subcategories (categories with parents)
  const subcategories = Array.from(categoryMap.entries())
    .filter(([_, v]) => v.parentId !== null)
    .map(([name, v]) => ({ name, ...v }));

  for (let i = 0; i < count; i++) {
    const category = faker.helpers.arrayElement(subcategories);
    const brand = faker.company.name();
    const productType = faker.commerce.product();
    const adjective = faker.commerce.productAdjective();
    const name = `${brand} ${adjective} ${productType}`;

    // Generate unique slug
    let slug = slugify(name);
    let slugCounter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(name).substring(0, 90)}-${slugCounter++}`;
    }
    existingSlugs.add(slug);

    // Generate unique SKU
    let sku = generateSKU(brand, i);
    while (existingSKUs.has(sku)) {
      sku = generateSKU(brand, i + Math.floor(Math.random() * 10000));
    }
    existingSKUs.add(sku);

    const price = parseFloat(faker.commerce.price({ min: 9.99, max: 999.99 }));
    const hasDiscount = faker.datatype.boolean({ probability: 0.3 });
    const comparePrice = hasDiscount ? Math.round(price * faker.number.float({ min: 1.1, max: 1.5 }) * 100) / 100 : null;

    products.push({
      name: name.substring(0, 255),
      description: faker.commerce.productDescription(),
      sku,
      slug,
      price,
      comparePrice,
      categoryId: category.id,
      brand: brand.substring(0, 100),
      images: [
        `https://picsum.photos/seed/${sku}/800/800`,
        `https://picsum.photos/seed/${sku}a/800/800`,
        `https://picsum.photos/seed/${sku}b/800/800`,
      ],
      inventory: faker.number.int({ min: 0, max: 500 }),
      lowStockThreshold: faker.helpers.arrayElement([5, 10, 15, 20]),
      isActive: true,
      isFeatured: faker.datatype.boolean({ probability: 0.08 }),
      tags: [brand, productType, category.name].filter(Boolean).slice(0, 5),
      attributes: {
        rating: faker.number.float({ min: 3.0, max: 5.0, fractionDigits: 1 }),
        reviewCount: faker.number.int({ min: 0, max: 1000 }),
        source: 'Synthetic',
        material: faker.commerce.productMaterial(),
      },
    });

    if (products.length >= 100) {
      await prisma.product.createMany({ data: products, skipDuplicates: true });
      inserted += products.length;
      console.log(`   → Generated ${inserted} synthetic products...`);
      products.length = 0;
    }
  }

  if (products.length > 0) {
    await prisma.product.createMany({ data: products, skipDuplicates: true });
    inserted += products.length;
  }

  console.log(`   Completed synthetic: ${inserted} products`);
  return inserted;
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ShopSphere Production Database Seeder');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    console.log('Clearing existing data...');
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    console.log('   Database cleared\n');

    // Seed categories
    const categoryMap = await seedCategories();
    console.log('');

    // Track unique slugs and SKUs
    const existingSlugs = new Set<string>();
    const existingSKUs = new Set<string>();

    // Process real data
    let total = 0;
    total += await processAmazonData(categoryMap, existingSlugs, existingSKUs);
    console.log('');
    total += await processWalmartData(categoryMap, existingSlugs, existingSKUs);
    console.log('');

    // Add synthetic products to fill gaps
    total += await generateSyntheticProducts(categoryMap, existingSlugs, existingSKUs, 500);
    console.log('');

    // Print summary
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    const featuredCount = await prisma.product.count({ where: { isFeatured: true } });
    const lowStockCount = await prisma.product.count({
      where: { inventory: { lte: prisma.product.fields.lowStockThreshold } },
    });

    // Get category breakdown
    const categoryBreakdown = await prisma.category.findMany({
      where: { parentId: null },
      select: {
        name: true,
        _count: { select: { products: true } },
        children: {
          select: {
            name: true,
            _count: { select: { products: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SEEDING COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Products:     ${productCount.toLocaleString()}`);
    console.log(`  Categories:         ${categoryCount}`);
    console.log(`  Featured Products:  ${featuredCount}`);
    console.log(`  Low Stock Items:    ${lowStockCount}`);
    console.log('');
    console.log('  Products by Category:');
    for (const cat of categoryBreakdown) {
      const childTotal = cat.children.reduce((sum, c) => sum + c._count.products, 0);
      const directProducts = cat._count.products;
      console.log(`    ${cat.name}: ${directProducts + childTotal}`);
      for (const child of cat.children) {
        if (child._count.products > 0) {
          console.log(`      └─ ${child.name}: ${child._count.products}`);
        }
      }
    }
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
