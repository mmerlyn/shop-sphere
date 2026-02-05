import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Data directory - use /app/data when running in Docker, or relative path for local
const DATA_DIR = fs.existsSync('/app/data') ? '/app/data' : path.join(__dirname, '../../../data');

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
    .substring(0, 100);
}

function generateSKU(prefix: string, index: number): string {
  const p = prefix.substring(0, 3).toUpperCase() || 'PRD';
  return `${p}-${Date.now().toString(36).toUpperCase()}-${index.toString().padStart(5, '0')}`;
}

function parseImages(imageStr: string | undefined): string[] {
  if (!imageStr) return [];
  return imageStr
    .split(/[,~|]/)
    .map(url => url.trim())
    .filter(url => url.startsWith('http'))
    .slice(0, 5);
}

async function seedCategories(): Promise<Map<string, string>> {
  console.log('Seeding categories...');

  const categoryMap = new Map<string, string>();

  const categories = [
    { name: 'Electronics', description: 'Electronic devices and gadgets' },
    { name: 'Computers', description: 'Computers and accessories' },
    { name: 'Mobile Phones', description: 'Smartphones and tablets' },
    { name: 'Audio', description: 'Headphones, speakers, and audio equipment' },
    { name: 'Cameras', description: 'Cameras and photography' },
    { name: 'Gaming', description: 'Gaming consoles and accessories' },
    { name: 'Home & Garden', description: 'Home improvement and garden' },
    { name: 'Appliances', description: 'Home appliances' },
    { name: 'Fashion', description: 'Clothing and accessories' },
    { name: 'Sports', description: 'Sports and outdoor' },
    { name: 'Food & Beverages', description: 'Food, drinks, and groceries' },
    { name: 'Health & Beauty', description: 'Health and beauty products' },
    { name: 'Tools', description: 'Tools and hardware' },
    { name: 'Accessories', description: 'Various accessories' },
    { name: 'Other', description: 'Other products' },
  ];

  for (const cat of categories) {
    const slug = slugify(cat.name);
    const existing = await prisma.category.findUnique({ where: { slug } });

    if (existing) {
      categoryMap.set(cat.name.toLowerCase(), existing.id);
    } else {
      const created = await prisma.category.create({
        data: { name: cat.name, description: cat.description, slug, isActive: true },
      });
      categoryMap.set(cat.name.toLowerCase(), created.id);
    }
  }

  console.log(`Created ${categoryMap.size} categories`);
  return categoryMap;
}

function mapCategory(text: string, categoryMap: Map<string, string>): string {
  const lower = text.toLowerCase();

  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('smartphone') || lower.includes('tablet'))
    return categoryMap.get('mobile phones')!;
  if (lower.includes('computer') || lower.includes('laptop') || lower.includes('pc ') || lower.includes('keyboard') || lower.includes('mouse'))
    return categoryMap.get('computers')!;
  if (lower.includes('tv') || lower.includes('television') || lower.includes('theater') || lower.includes('projector'))
    return categoryMap.get('electronics')!;
  if (lower.includes('audio') || lower.includes('headphone') || lower.includes('speaker') || lower.includes('sound') || lower.includes('earphone'))
    return categoryMap.get('audio')!;
  if (lower.includes('camera') || lower.includes('photo') || lower.includes('lens'))
    return categoryMap.get('cameras')!;
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('playstation') || lower.includes('xbox') || lower.includes('nintendo'))
    return categoryMap.get('gaming')!;
  if (lower.includes('tool') || lower.includes('drill') || lower.includes('saw') || lower.includes('hammer'))
    return categoryMap.get('tools')!;
  if (lower.includes('cloth') || lower.includes('shirt') || lower.includes('pant') || lower.includes('jacket') || lower.includes('sweatshirt') || lower.includes('dress'))
    return categoryMap.get('fashion')!;
  if (lower.includes('food') || lower.includes('juice') || lower.includes('beverage') || lower.includes('snack') || lower.includes('drink') || lower.includes('coffee') || lower.includes('tea'))
    return categoryMap.get('food & beverages')!;
  if (lower.includes('health') || lower.includes('beauty') || lower.includes('skin') || lower.includes('hair') || lower.includes('soap'))
    return categoryMap.get('health & beauty')!;
  if (lower.includes('sport') || lower.includes('fitness') || lower.includes('outdoor') || lower.includes('gym'))
    return categoryMap.get('sports')!;
  if (lower.includes('home') || lower.includes('garden') || lower.includes('furniture') || lower.includes('decor') || lower.includes('light') || lower.includes('lamp'))
    return categoryMap.get('home & garden')!;
  if (lower.includes('appliance') || lower.includes('kitchen') || lower.includes('refrigerator') || lower.includes('microwave') || lower.includes('washer'))
    return categoryMap.get('appliances')!;
  if (lower.includes('accessor') || lower.includes('cable') || lower.includes('charger') || lower.includes('adapter') || lower.includes('case') || lower.includes('cover'))
    return categoryMap.get('accessories')!;

  return categoryMap.get('other')!;
}

interface ProductData {
  name: string;
  description: string;
  brand: string | null;
  price: number;
  comparePrice: number | null;
  images: string[];
  categoryId: string;
  tags: string[];
}

async function seedDatafinitiProducts(categoryMap: Map<string, string>, existingSlugs: Set<string>, existingSKUs: Set<string>): Promise<number> {
  const filePath = path.join(DATA_DIR, 'DatafinitiElectronicsProductData.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log('Datafinity file not found, skipping...');
    return 0;
  }

  console.log('Processing Datafinity Electronics...');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(sheet);

  let count = 0;
  const products: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row.name) continue;

    let slug = slugify(row.name);
    let slugCounter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(row.name)}-${slugCounter++}`;
    }
    existingSlugs.add(slug);

    let sku = generateSKU(row.brand || 'ELC', count);
    while (existingSKUs.has(sku)) {
      sku = generateSKU(row.brand || 'ELC', count + Math.floor(Math.random() * 10000));
    }
    existingSKUs.add(sku);

    const price = Math.round((Math.random() * 500 + 20) * 100) / 100;
    const hasCompare = Math.random() < 0.3;
    const categoryText = (row.categories || '') + ' ' + (row.name || '');

    products.push({
      name: row.name.substring(0, 255),
      description: row.name + (row.brand ? ` by ${row.brand}` : '') + '. Quality product available at ShopSphere.',
      sku,
      slug,
      price,
      comparePrice: hasCompare ? Math.round(price * 1.3 * 100) / 100 : null,
      categoryId: mapCategory(categoryText, categoryMap),
      brand: row.brand?.substring(0, 100) || null,
      images: parseImages(row.imageURLs),
      inventory: Math.floor(Math.random() * 100) + 10,
      lowStockThreshold: 10,
      isActive: true,
      isFeatured: Math.random() < 0.05,
      tags: row.brand ? [row.brand] : [],
    });

    if (products.length >= 100) {
      await prisma.product.createMany({ data: products, skipDuplicates: true });
      count += products.length;
      console.log(`  Inserted ${count} products...`);
      products.length = 0;
    }
  }

  if (products.length > 0) {
    await prisma.product.createMany({ data: products, skipDuplicates: true });
    count += products.length;
  }

  console.log(`  Completed Datafinity: ${count} products`);
  return count;
}

async function seedHomeDepotProducts(categoryMap: Map<string, string>, existingSlugs: Set<string>, existingSKUs: Set<string>): Promise<number> {
  const filePath = path.join(DATA_DIR, 'home_depot_data_1_2021_12.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log('Home Depot file not found, skipping...');
    return 0;
  }

  console.log('Processing Home Depot...');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(sheet);

  let count = 0;
  const products: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row.title) continue;

    let slug = slugify(row.title);
    let slugCounter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(row.title)}-${slugCounter++}`;
    }
    existingSlugs.add(slug);

    let sku = row.sku ? String(row.sku) : generateSKU('HD', count);
    while (existingSKUs.has(sku)) {
      sku = generateSKU('HD', count + Math.floor(Math.random() * 10000));
    }
    existingSKUs.add(sku);

    const price = row.price ? parseFloat(row.price) : Math.round((Math.random() * 200 + 15) * 100) / 100;
    const hasCompare = Math.random() < 0.25;

    products.push({
      name: row.title.substring(0, 255),
      description: row.description?.substring(0, 1000) || row.title,
      sku,
      slug,
      price,
      comparePrice: hasCompare ? Math.round(price * 1.2 * 100) / 100 : null,
      categoryId: mapCategory(row.title + ' ' + (row.brand || ''), categoryMap),
      brand: row.brand?.substring(0, 100) || null,
      images: parseImages(row.images),
      inventory: Math.floor(Math.random() * 100) + 10,
      lowStockThreshold: 10,
      isActive: true,
      isFeatured: Math.random() < 0.05,
      tags: row.brand ? [row.brand] : [],
    });

    if (products.length >= 100) {
      await prisma.product.createMany({ data: products, skipDuplicates: true });
      count += products.length;
      console.log(`  Inserted ${count} products...`);
      products.length = 0;
    }
  }

  if (products.length > 0) {
    await prisma.product.createMany({ data: products, skipDuplicates: true });
    count += products.length;
  }

  console.log(`  Completed Home Depot: ${count} products`);
  return count;
}

async function seedFlipkartProducts(categoryMap: Map<string, string>, existingSlugs: Set<string>, existingSKUs: Set<string>): Promise<number> {
  const filePath = path.join(DATA_DIR, 'home_sdf_marketing_sample_for_flipkart_com-ecommerce__20191101_20191130__15k_data.xlsx');
  if (!fs.existsSync(filePath)) {
    console.log('Flipkart file not found, skipping...');
    return 0;
  }

  console.log('Processing Flipkart...');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(sheet);

  let count = 0;
  const products: any[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const title = row['Product Title'];
    if (!title) continue;

    let slug = slugify(title);
    let slugCounter = 1;
    while (existingSlugs.has(slug)) {
      slug = `${slugify(title)}-${slugCounter++}`;
    }
    existingSlugs.add(slug);

    let sku = generateSKU('FK', count);
    while (existingSKUs.has(sku)) {
      sku = generateSKU('FK', count + Math.floor(Math.random() * 10000));
    }
    existingSKUs.add(sku);

    // Convert INR to USD (roughly 1 USD = 83 INR)
    const priceINR = row['Price'] || row['Mrp'] || 500;
    const price = Math.round((priceINR / 83) * 100) / 100;
    const mrpINR = row['Mrp'];
    const comparePrice = mrpINR && mrpINR > priceINR ? Math.round((mrpINR / 83) * 100) / 100 : null;

    const category = String(row['Bb Category'] || '');
    const brand = row['Brand'] ? String(row['Brand']).substring(0, 100) : null;

    products.push({
      name: title.substring(0, 255),
      description: `${title}. ${row['Quantity Or Pack Size'] || ''}`.trim(),
      sku,
      slug,
      price: price > 0 ? price : 9.99,
      comparePrice,
      categoryId: mapCategory(category + ' ' + title, categoryMap),
      brand,
      images: row['Image Url'] ? [row['Image Url']] : [],
      inventory: Math.floor(Math.random() * 100) + 10,
      lowStockThreshold: 10,
      isActive: true,
      isFeatured: Math.random() < 0.03,
      tags: brand ? [brand, category].filter(Boolean) : [category].filter(Boolean),
    });

    if (products.length >= 100) {
      await prisma.product.createMany({ data: products, skipDuplicates: true });
      count += products.length;
      console.log(`  Inserted ${count} products...`);
      products.length = 0;
    }
  }

  if (products.length > 0) {
    await prisma.product.createMany({ data: products, skipDuplicates: true });
    count += products.length;
  }

  console.log(`  Completed Flipkart: ${count} products`);
  return count;
}

async function main() {
  console.log('Starting database seed...\n');

  try {
    console.log('Clearing existing data...');
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();

    const categoryMap = await seedCategories();

    const existingSlugs = new Set<string>();
    const existingSKUs = new Set<string>();

    let total = 0;
    total += await seedDatafinitiProducts(categoryMap, existingSlugs, existingSKUs);
    total += await seedHomeDepotProducts(categoryMap, existingSlugs, existingSKUs);
    total += await seedFlipkartProducts(categoryMap, existingSlugs, existingSKUs);

    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    const featuredCount = await prisma.product.count({ where: { isFeatured: true } });

    // Get category breakdown
    const categoryBreakdown = await prisma.category.findMany({
      select: { name: true, _count: { select: { products: true } } },
      orderBy: { products: { _count: 'desc' } },
    });

    console.log('\n--- Summary ---');
    console.log(`Total Products: ${productCount}`);
    console.log(`Categories: ${categoryCount}`);
    console.log(`Featured: ${featuredCount}`);
    console.log('\nProducts by Category:');
    categoryBreakdown.forEach(c => {
      if (c._count.products > 0) {
        console.log(`  ${c.name}: ${c._count.products}`);
      }
    });

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
