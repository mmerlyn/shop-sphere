import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Configuration
const TARGET_PRODUCTS = 1_000_000;
const BATCH_SIZE = 2000;
const PROGRESS_INTERVAL = 50000;

// Data directory
const DATA_DIR = fs.existsSync('/app/data')
  ? '/app/data'
  : path.join(__dirname, '../../../data');

// Product variations to create multiple products from one real product
const VARIATIONS = [
  '', // Original
  ' - 2 Pack',
  ' - 3 Pack',
  ' - Value Bundle',
  ' - Premium Edition',
  ' - Limited Edition',
  ' - Pro Version',
  ' - Lite',
  ' - XL',
  ' - Mini',
  ' - Plus',
  ' - Max',
  ' - New Model',
  ' - 2024 Edition',
  ' - Classic',
  ' - Deluxe',
  ' - Essential',
  ' - Professional',
  ' - Home Edition',
  ' - Travel Size',
];

const PRICE_MODIFIERS = [1.0, 1.8, 2.5, 1.5, 1.3, 1.4, 1.6, 0.8, 1.2, 0.7, 1.1, 1.25, 1.15, 1.05, 0.95, 1.35, 0.9, 1.45, 0.85, 0.75];

// Category mapping from DummyJSON to our categories (primary mapping)
const CATEGORY_MAPPING: Record<string, string> = {
  'beauty': 'Makeup',
  'fragrances': 'Fragrances',
  'furniture': 'Furniture',
  'groceries': 'Fresh Food',
  'home-decoration': 'Home Decor',
  'kitchen-accessories': 'Kitchen & Dining',
  'laptops': 'Computers & Laptops',
  'mens-shirts': "Men's Clothing",
  'mens-shoes': 'Shoes',
  'mens-watches': 'Watches',
  'mobile-accessories': 'Audio & Headphones',
  'motorcycle': 'Parts & Accessories',
  'skin-care': 'Skincare',
  'smartphones': 'Mobile Phones',
  'sports-accessories': 'Exercise & Fitness',
  'sunglasses': 'Bags & Accessories',
  'tablets': 'Computers & Laptops',
  'tops': "Women's Clothing",
  'vehicle': 'Parts & Accessories',
  'womens-bags': 'Bags & Accessories',
  'womens-dresses': "Women's Clothing",
  'womens-jewellery': 'Jewelry',
  'womens-shoes': 'Shoes',
  'womens-watches': 'Watches',
};

// Which DummyJSON products can be reasonably placed in which categories
// This allows the same product to appear in multiple related categories
const CATEGORY_PRODUCT_TYPES: Record<string, string[]> = {
  'Computers & Laptops': ['laptops', 'tablets', 'smartphones'],
  'Mobile Phones': ['smartphones', 'tablets', 'mobile-accessories'],
  'Audio & Headphones': ['mobile-accessories'],
  'Cameras & Photography': ['smartphones', 'mobile-accessories'],
  'TV & Home Theater': ['laptops', 'tablets'],
  'Gaming': ['laptops', 'tablets', 'mobile-accessories'],
  'Wearables': ['mens-watches', 'womens-watches', 'mobile-accessories'],
  'Furniture': ['furniture', 'home-decoration'],
  'Kitchen & Dining': ['kitchen-accessories', 'groceries'],
  'Bedding & Bath': ['home-decoration', 'furniture'],
  'Home Decor': ['home-decoration', 'furniture'],
  'Garden & Outdoor': ['home-decoration', 'sports-accessories'],
  "Men's Clothing": ['mens-shirts', 'mens-shoes', 'sunglasses'],
  "Women's Clothing": ['womens-dresses', 'tops', 'womens-shoes', 'sunglasses'],
  'Shoes': ['mens-shoes', 'womens-shoes', 'sports-accessories'],
  'Bags & Accessories': ['womens-bags', 'sunglasses'],
  'Jewelry': ['womens-jewellery', 'mens-watches', 'womens-watches'],
  'Watches': ['mens-watches', 'womens-watches'],
  'Skincare': ['skin-care', 'beauty'],
  'Haircare': ['beauty', 'skin-care'],
  'Makeup': ['beauty'],
  'Personal Care': ['beauty', 'skin-care', 'fragrances'],
  'Fragrances': ['fragrances'],
  'Exercise & Fitness': ['sports-accessories'],
  'Outdoor Recreation': ['sports-accessories', 'vehicle'],
  'Team Sports': ['sports-accessories'],
  'Snacks & Candy': ['groceries'],
  'Beverages': ['groceries', 'kitchen-accessories'],
  'Fresh Food': ['groceries'],
  'Car Electronics': ['mobile-accessories', 'vehicle'],
  'Parts & Accessories': ['vehicle', 'motorcycle'],
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
    .substring(0, 70);
}

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
// LOAD REAL DATA
// ============================================================================
interface RealProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand: string;
  sku: string;
  images: string[];
  thumbnail: string;
}

function loadRealProducts(): RealProduct[] {
  const filePath = path.join(DATA_DIR, 'dummyjson-products.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Real product data not found at ${filePath}. Run: curl -s "https://dummyjson.com/products?limit=200" > ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`   Loaded ${data.products.length} real products from DummyJSON`);
  return data.products;
}

// ============================================================================
// CATEGORY SEEDING
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
      Fragrances: 'Perfumes and colognes',
    },
  },
  'Sports & Outdoors': {
    description: 'Sports equipment and outdoor gear',
    children: {
      'Exercise & Fitness': 'Gym equipment and fitness accessories',
      'Outdoor Recreation': 'Camping, hiking, and outdoor gear',
      'Team Sports': 'Equipment for team sports',
    },
  },
  'Food & Grocery': {
    description: 'Food, beverages, and grocery items',
    children: {
      'Snacks & Candy': 'Chips, cookies, and confectionery',
      Beverages: 'Coffee, tea, and drinks',
      'Fresh Food': 'Fruits, vegetables, and fresh items',
    },
  },
  Automotive: {
    description: 'Auto parts, accessories, and tools',
    children: {
      'Car Electronics': 'Audio, GPS, and car gadgets',
      'Parts & Accessories': 'Replacement parts and upgrades',
    },
  },
};

interface CategoryInfo {
  id: string;
  name: string;
}

async function seedCategories(): Promise<Map<string, CategoryInfo>> {
  console.log('Seeding categories...');
  const categoryMap = new Map<string, CategoryInfo>();

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
      categoryMap.set(childName.toLowerCase(), { id: child.id, name: childName });
    }
  }

  console.log(`   Created ${categoryMap.size} categories`);
  return categoryMap;
}

// ============================================================================
// MAIN SEEDING
// ============================================================================
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ShopSphere REAL Product Database Seeder');
  console.log(`  Target: ${TARGET_PRODUCTS.toLocaleString()} products`);
  console.log('  Source: DummyJSON (194 real products with matching images)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const totalStart = Date.now();

  try {
    console.log('Clearing existing data...');
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    console.log('   Database cleared\n');

    // Seed categories
    const categoryMap = await seedCategories();

    console.log('\nLoading real product data...');
    const realProducts = loadRealProducts();

    // Group products by their DummyJSON category
    const productsByDummyCategory = new Map<string, RealProduct[]>();
    for (const product of realProducts) {
      const cat = product.category;
      if (!productsByDummyCategory.has(cat)) {
        productsByDummyCategory.set(cat, []);
      }
      productsByDummyCategory.get(cat)!.push(product);
    }

    // Get all our categories as an array for cycling
    const allCategories = Array.from(categoryMap.values());
    const numCategories = allCategories.length;

    console.log(`\nGenerating ${TARGET_PRODUCTS.toLocaleString()} products...`);
    console.log(`   Distributing evenly across ${numCategories} categories`);
    console.log(`   ~${Math.floor(TARGET_PRODUCTS / numCategories).toLocaleString()} products per category\n`);

    let created = 0;
    const startTime = Date.now();

    while (created < TARGET_PRODUCTS) {
      const batchSize = Math.min(BATCH_SIZE, TARGET_PRODUCTS - created);
      const products: Prisma.ProductCreateManyInput[] = [];

      for (let i = 0; i < batchSize; i++) {
        const index = created + i;

        // Distribute evenly across categories
        const categoryIndex = index % numCategories;
        const category = allCategories[categoryIndex];
        const categoryName = category.name;

        // Find appropriate products for this category
        const allowedDummyCategories = CATEGORY_PRODUCT_TYPES[categoryName] || Object.keys(CATEGORY_MAPPING);

        // Get all products that match the allowed categories
        let matchingProducts: RealProduct[] = [];
        for (const dummyCat of allowedDummyCategories) {
          const prods = productsByDummyCategory.get(dummyCat);
          if (prods) {
            matchingProducts.push(...prods);
          }
        }

        // Fallback to all products if no match
        if (matchingProducts.length === 0) {
          matchingProducts = realProducts;
        }

        // Pick a product based on the index within this category
        const productIndexInCategory = Math.floor(index / numCategories);
        const productIndex = productIndexInCategory % matchingProducts.length;
        const variationIndex = Math.floor(productIndexInCategory / matchingProducts.length) % VARIATIONS.length;
        const cycleNumber = Math.floor(productIndexInCategory / (matchingProducts.length * VARIATIONS.length));

        const realProduct = matchingProducts[productIndex];
        const variation = VARIATIONS[variationIndex];
        const priceModifier = PRICE_MODIFIERS[variationIndex];

        // Build product name with variation
        let name = realProduct.title + variation;
        if (cycleNumber > 0) {
          name += ` #${cycleNumber + 1}`;
        }

        // Generate unique identifiers
        const sku = `${realProduct.sku}-${categoryIndex}-${variationIndex}-${cycleNumber}`.substring(0, 50);
        const slug = `${slugify(realProduct.title)}-${categoryIndex}-${index}`;

        // Calculate price with variation
        const basePrice = realProduct.price * priceModifier;
        const price = Math.round(basePrice * 100) / 100;
        const hasDiscount = realProduct.discountPercentage > 0;
        const comparePrice = hasDiscount
          ? Math.round(price * (1 + realProduct.discountPercentage / 100) * 100) / 100
          : null;

        // Use real images - thumbnail for main, full images for gallery
        const images = [
          realProduct.thumbnail,
          ...(realProduct.images || []).slice(0, 3),
        ].filter(Boolean);

        products.push({
          name: name.substring(0, 255),
          description: realProduct.description,
          sku,
          slug,
          price: new Prisma.Decimal(price),
          comparePrice: comparePrice ? new Prisma.Decimal(comparePrice) : null,
          categoryId: category.id,
          brand: realProduct.brand || 'Generic',
          images,
          inventory: Math.floor(Math.random() * 500) + realProduct.stock,
          lowStockThreshold: [5, 10, 15, 20][Math.floor(Math.random() * 4)],
          isActive: Math.random() > 0.02,
          isFeatured: Math.random() < 0.03,
          tags: realProduct.tags || [],
          attributes: {
            rating: realProduct.rating,
            reviewCount: Math.floor(Math.random() * 500) + 10,
            originalProductId: realProduct.id,
            variation: variation || 'Standard',
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
    const uniqueBrands = await prisma.product.groupBy({ by: ['brand'], _count: true });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SEEDING COMPLETE - REAL PRODUCT DATA');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Products:     ${finalCount.toLocaleString()}`);
    console.log(`  Active Products:    ${activeCount.toLocaleString()}`);
    console.log(`  Featured Products:  ${featuredCount.toLocaleString()}`);
    console.log(`  Categories:         ${categoryCount}`);
    console.log(`  Unique Brands:      ${uniqueBrands.length}`);
    console.log(`  Average Price:      $${Number(avgPrice._avg.price).toFixed(2)}`);
    console.log(`  Total Time:         ${totalElapsed.toFixed(1)}s`);
    console.log(`  Insert Rate:        ${Math.round(finalCount / totalElapsed).toLocaleString()}/sec`);
    console.log('');
    console.log('  All products have REAL matching images!');
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
