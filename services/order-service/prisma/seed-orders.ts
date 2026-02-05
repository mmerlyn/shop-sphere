import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 2000;
const TARGET_ORDERS = 500_000;

const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const statusWeights = [5, 10, 10, 15, 45, 10, 5];

const paymentMethods = ['card', 'paypal', 'apple_pay', 'google_pay'];
const productNames = [
  'Wireless Headphones', 'Laptop Stand', 'USB-C Hub', 'Mechanical Keyboard',
  'Gaming Mouse', '4K Monitor', 'Webcam Pro', 'Portable SSD', 'Smart Watch',
  'Bluetooth Speaker', 'Phone Case', 'Screen Protector', 'Charging Cable',
  'Power Bank', 'Tablet Cover', 'Mouse Pad', 'Desk Lamp', 'Cable Organizer',
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedRandom(items: string[], weights: number[]): string {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateOrderNumber(index: number): string {
  const prefix = 'ORD';
  const timestamp = (Date.now() + index).toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}-${index}`;
}

async function main() {
  console.log('Starting order seed...');

  const existingCount = await prisma.order.count();
  const remaining = TARGET_ORDERS - existingCount;

  if (remaining <= 0) {
    console.log(`Already have ${existingCount} orders. Target: ${TARGET_ORDERS}`);
    return;
  }

  console.log(`Existing orders: ${existingCount}`);
  console.log(`Orders to generate: ${remaining}`);

  // Generate user IDs (simulated)
  const userIds = Array.from({ length: 10000 }, (_, i) =>
    `user-${String(i).padStart(6, '0')}`
  );

  let created = 0;
  const startTime = Date.now();

  // Date ranges for partition distribution
  const partitionStart = new Date('2024-01-01');
  const partitionEnd = new Date('2026-06-30');

  while (created < remaining) {
    const batchSize = Math.min(BATCH_SIZE, remaining - created);

    for (let i = 0; i < batchSize; i++) {
      const index = existingCount + created + i;
      const userId = randomElement(userIds);
      const status = weightedRandom(statuses, statusWeights);
      const itemCount = Math.floor(Math.random() * 5) + 1;
      const orderDate = randomDate(partitionStart, partitionEnd);

      let subtotal = 0;
      const items: Prisma.OrderItemCreateManyOrderInput[] = [];

      for (let j = 0; j < itemCount; j++) {
        const price = Math.round((9.99 + Math.random() * 990) * 100) / 100;
        const quantity = Math.floor(Math.random() * 3) + 1;
        subtotal += price * quantity;

        items.push({
          productId: `prod-${Math.floor(Math.random() * 1000000)}`,
          name: randomElement(productNames),
          sku: `SKU-${Math.floor(Math.random() * 10000000)}`,
          price: new Prisma.Decimal(price),
          quantity,
          image: `https://picsum.photos/seed/${index}-${j}/200/200`,
        });
      }

      const discount = Math.random() > 0.8 ? Math.round(subtotal * Math.random() * 0.2 * 100) / 100 : 0;
      const shippingCost = subtotal >= 100 ? 0 : 9.99;
      const tax = Math.round((subtotal - discount) * 0.08 * 100) / 100;
      const total = Math.round((subtotal - discount + shippingCost + tax) * 100) / 100;

      try {
        await prisma.order.create({
          data: {
            orderNumber: generateOrderNumber(index),
            userId,
            status: status as any,
            subtotal: new Prisma.Decimal(subtotal),
            discount: new Prisma.Decimal(discount),
            shippingCost: new Prisma.Decimal(shippingCost),
            tax: new Prisma.Decimal(tax),
            total: new Prisma.Decimal(total),
            couponCode: Math.random() > 0.9 ? `SAVE${Math.floor(Math.random() * 50)}` : null,
            shippingAddress: {
              firstName: 'Test',
              lastName: `User${index}`,
              address1: `${Math.floor(Math.random() * 9999)} Main St`,
              city: randomElement(['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego']),
              state: randomElement(['NY', 'CA', 'IL', 'TX', 'AZ', 'PA']),
              postalCode: String(Math.floor(Math.random() * 90000) + 10000),
              country: 'US',
            },
            paymentMethod: randomElement(paymentMethods),
            paymentId: Math.random() > 0.3 ? `pi_${Math.random().toString(36).substring(2, 28)}` : null,
            createdAt: orderDate,
            updatedAt: orderDate,
            items: {
              create: items,
            },
          },
        });
      } catch (e) {
        // Skip duplicate order numbers
      }
    }

    created += batchSize;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = Math.round(created / (parseFloat(elapsed) || 1));
    console.log(`Progress: ${created}/${remaining} (${Math.round(created / remaining * 100)}%) - ${rate} orders/sec - ${elapsed}s elapsed`);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const finalCount = await prisma.order.count();
  console.log(`\nSeeding complete!`);
  console.log(`Total orders: ${finalCount}`);
  console.log(`Time elapsed: ${totalElapsed}s`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
