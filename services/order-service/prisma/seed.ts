// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { OrderStatus, PaymentStatus } from '../src/orders/enums';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding order service database...');

  // Clean existing data
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();

  // Create sample orders
  const sampleOrders = [
    {
      orderNumber: 'ORD-001',
      userId: 'user-1',
      status: OrderStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
      subtotal: 199.99,
      taxAmount: 16.00,
      shippingCost: 0,
      discountAmount: 20.00,
      totalAmount: 195.99,
      paymentMethod: 'credit_card',
      paymentId: 'pay_123456789',
      customerEmail: 'john.doe@example.com',
      customerPhone: '+1234567890',
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
        phone: '+1234567890'
      },
      billingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address1: '123 Main St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
        phone: '+1234567890'
      },
      couponCode: 'WELCOME20',
      couponDiscount: 20.00,
      shippedAt: new Date('2024-01-15T10:00:00Z'),
      deliveredAt: new Date('2024-01-18T14:30:00Z'),
      items: [
        {
          productId: 'prod-1',
          productName: 'Wireless Headphones',
          productSku: 'WH-001',
          productSlug: 'wireless-headphones',
          unitPrice: 199.99,
          quantity: 1,
          totalPrice: 199.99,
          productImage: 'https://example.com/headphones.jpg',
          brand: 'TechBrand',
          category: 'Electronics'
        }
      ]
    },
    {
      orderNumber: 'ORD-002',
      userId: 'user-2',
      status: OrderStatus.PROCESSING,
      paymentStatus: PaymentStatus.PAID,
      subtotal: 299.98,
      taxAmount: 24.00,
      shippingCost: 10.00,
      discountAmount: 0,
      totalAmount: 333.98,
      paymentMethod: 'paypal',
      paymentId: 'pay_987654321',
      customerEmail: 'jane.smith@example.com',
      customerPhone: '+1987654321',
      shippingAddress: {
        firstName: 'Jane',
        lastName: 'Smith',
        address1: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
        phone: '+1987654321'
      },
      billingAddress: {
        firstName: 'Jane',
        lastName: 'Smith',
        address1: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        postalCode: '90210',
        country: 'US',
        phone: '+1987654321'
      },
      items: [
        {
          productId: 'prod-2',
          productName: 'Smart Watch',
          productSku: 'SW-001',
          productSlug: 'smart-watch',
          unitPrice: 149.99,
          quantity: 2,
          totalPrice: 299.98,
          productImage: 'https://example.com/smartwatch.jpg',
          brand: 'WearTech',
          category: 'Electronics'
        }
      ]
    },
    {
      orderNumber: 'ORD-003',
      sessionId: 'guest-session-123',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      subtotal: 49.99,
      taxAmount: 4.00,
      shippingCost: 8.99,
      discountAmount: 0,
      totalAmount: 62.98,
      customerEmail: 'guest@example.com',
      shippingAddress: {
        firstName: 'Guest',
        lastName: 'User',
        address1: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'US'
      },
      billingAddress: {
        firstName: 'Guest',
        lastName: 'User',
        address1: '789 Pine St',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60601',
        country: 'US'
      },
      items: [
        {
          productId: 'prod-3',
          productName: 'Phone Case',
          productSku: 'PC-001',
          productSlug: 'phone-case',
          unitPrice: 49.99,
          quantity: 1,
          totalPrice: 49.99,
          productImage: 'https://example.com/phonecase.jpg',
          brand: 'ProtectTech',
          category: 'Accessories'
        }
      ]
    }
  ];

  for (const orderData of sampleOrders) {
    const { items, ...orderInfo } = orderData;
    
    const order = await prisma.order.create({
      data: {
        ...orderInfo,
        items: {
          create: items
        },
        statusHistory: {
          create: [
            {
              toStatus: OrderStatus.PENDING,
              reason: 'Order created',
              changedByType: 'SYSTEM'
            },
            ...(orderData.status !== OrderStatus.PENDING ? [
              {
                fromStatus: OrderStatus.PENDING,
                toStatus: orderData.status,
                reason: 'Order status updated',
                changedByType: 'SYSTEM'
              }
            ] : [])
          ]
        }
      }
    });

    console.log(`✅ Created order: ${order.orderNumber}`);
  }

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });