import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Electronics', slug: 'electronics', description: 'Electronic devices and gadgets' },
  { name: 'Clothing', slug: 'clothing', description: 'Fashion and apparel' },
  { name: 'Home & Garden', slug: 'home-garden', description: 'Home improvement and garden' },
  { name: 'Sports', slug: 'sports', description: 'Sports and outdoor equipment' },
  { name: 'Books', slug: 'books', description: 'Books and media' },
];

const products = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-cancelling wireless headphones with 30-hour battery life. Features include active noise cancellation, transparency mode, and premium sound quality.',
    sku: 'ELEC-HP-001',
    slug: 'wireless-bluetooth-headphones',
    price: 149.99,
    comparePrice: 199.99,
    brand: 'AudioTech',
    images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500'],
    inventory: 50,
    isFeatured: true,
    tags: ['wireless', 'bluetooth', 'noise-cancelling'],
    category: 'electronics',
  },
  {
    name: 'Smart Watch Pro',
    description: 'Advanced smartwatch with health monitoring, GPS tracking, and 7-day battery life. Water resistant up to 50m.',
    sku: 'ELEC-SW-001',
    slug: 'smart-watch-pro',
    price: 299.99,
    comparePrice: 349.99,
    brand: 'TechTime',
    images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'],
    inventory: 35,
    isFeatured: true,
    tags: ['smartwatch', 'fitness', 'gps'],
    category: 'electronics',
  },
  {
    name: 'Organic Cotton T-Shirt',
    description: '100% organic cotton t-shirt. Soft, breathable, and sustainable. Available in multiple colors.',
    sku: 'CLTH-TS-001',
    slug: 'organic-cotton-tshirt',
    price: 29.99,
    comparePrice: null,
    brand: 'EcoWear',
    images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500'],
    inventory: 200,
    isFeatured: false,
    tags: ['organic', 'cotton', 'sustainable'],
    category: 'clothing',
  },
  {
    name: 'Denim Jacket Classic',
    description: 'Classic denim jacket with a modern fit. Durable construction with brass buttons.',
    sku: 'CLTH-JK-001',
    slug: 'denim-jacket-classic',
    price: 89.99,
    comparePrice: 119.99,
    brand: 'DenimCo',
    images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500'],
    inventory: 75,
    isFeatured: true,
    tags: ['denim', 'jacket', 'classic'],
    category: 'clothing',
  },
  {
    name: 'Indoor Plant Set',
    description: 'Set of 3 low-maintenance indoor plants in decorative ceramic pots. Perfect for home or office.',
    sku: 'HOME-PL-001',
    slug: 'indoor-plant-set',
    price: 49.99,
    comparePrice: null,
    brand: 'GreenLife',
    images: ['https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=500'],
    inventory: 30,
    isFeatured: false,
    tags: ['plants', 'indoor', 'decor'],
    category: 'home-garden',
  },
  {
    name: 'LED Desk Lamp',
    description: 'Adjustable LED desk lamp with touch controls and USB charging port. Multiple brightness levels.',
    sku: 'HOME-LP-001',
    slug: 'led-desk-lamp',
    price: 39.99,
    comparePrice: 54.99,
    brand: 'LightPro',
    images: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500'],
    inventory: 100,
    isFeatured: true,
    tags: ['led', 'lamp', 'desk', 'usb'],
    category: 'home-garden',
  },
  {
    name: 'Yoga Mat Premium',
    description: 'Extra thick yoga mat with non-slip surface. Includes carrying strap. Eco-friendly materials.',
    sku: 'SPRT-YM-001',
    slug: 'yoga-mat-premium',
    price: 34.99,
    comparePrice: null,
    brand: 'ZenFit',
    images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500'],
    inventory: 150,
    isFeatured: false,
    tags: ['yoga', 'fitness', 'eco-friendly'],
    category: 'sports',
  },
  {
    name: 'Running Shoes Ultra',
    description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper.',
    sku: 'SPRT-RS-001',
    slug: 'running-shoes-ultra',
    price: 129.99,
    comparePrice: 159.99,
    brand: 'SpeedRun',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
    inventory: 60,
    isFeatured: true,
    tags: ['running', 'shoes', 'athletic'],
    category: 'sports',
  },
  {
    name: 'Bestseller Novel Collection',
    description: 'Collection of 5 bestselling novels from award-winning authors. Paperback edition.',
    sku: 'BOOK-NV-001',
    slug: 'bestseller-novel-collection',
    price: 59.99,
    comparePrice: 79.99,
    brand: 'BookHouse',
    images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500'],
    inventory: 40,
    isFeatured: false,
    tags: ['books', 'novels', 'fiction'],
    category: 'books',
  },
  {
    name: 'Portable Bluetooth Speaker',
    description: 'Waterproof portable speaker with 360-degree sound. 12-hour battery life.',
    sku: 'ELEC-SP-001',
    slug: 'portable-bluetooth-speaker',
    price: 79.99,
    comparePrice: 99.99,
    brand: 'SoundWave',
    images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500'],
    inventory: 80,
    isFeatured: true,
    tags: ['speaker', 'bluetooth', 'waterproof', 'portable'],
    category: 'electronics',
  },
  {
    name: 'Mechanical Keyboard RGB',
    description: 'Mechanical gaming keyboard with customizable RGB lighting and hot-swappable switches.',
    sku: 'ELEC-KB-001',
    slug: 'mechanical-keyboard-rgb',
    price: 119.99,
    comparePrice: null,
    brand: 'KeyMaster',
    images: ['https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=500'],
    inventory: 45,
    isFeatured: true,
    tags: ['keyboard', 'mechanical', 'gaming', 'rgb'],
    category: 'electronics',
  },
  {
    name: 'Wireless Charging Pad',
    description: 'Fast wireless charging pad compatible with all Qi-enabled devices. Sleek minimalist design.',
    sku: 'ELEC-CH-001',
    slug: 'wireless-charging-pad',
    price: 29.99,
    comparePrice: 39.99,
    brand: 'ChargeTech',
    images: ['https://images.unsplash.com/photo-1586816879360-004f5b0c51e5?w=500'],
    inventory: 120,
    isFeatured: false,
    tags: ['wireless', 'charging', 'qi'],
    category: 'electronics',
  },
];

async function main() {
  console.log('Starting test seed...\n');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // Create categories
  console.log('Creating categories...');
  const categoryMap = new Map<string, string>();

  for (const cat of categories) {
    const created = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        isActive: true,
      },
    });
    categoryMap.set(cat.slug, created.id);
    console.log(`  Created category: ${cat.name}`);
  }

  // Create products
  console.log('\nCreating products...');
  for (const product of products) {
    const categoryId = categoryMap.get(product.category);
    if (!categoryId) {
      console.log(`  Skipping ${product.name}: category not found`);
      continue;
    }

    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        sku: product.sku,
        slug: product.slug,
        price: product.price,
        comparePrice: product.comparePrice,
        brand: product.brand,
        images: product.images,
        inventory: product.inventory,
        lowStockThreshold: 10,
        isActive: true,
        isFeatured: product.isFeatured,
        tags: product.tags,
        categoryId,
      },
    });
    console.log(`  Created product: ${product.name}`);
  }

  // Summary
  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  const featuredCount = await prisma.product.count({ where: { isFeatured: true } });

  console.log('\n--- Summary ---');
  console.log(`Categories: ${categoryCount}`);
  console.log(`Products: ${productCount}`);
  console.log(`Featured Products: ${featuredCount}`);
  console.log('\nSeed complete!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
