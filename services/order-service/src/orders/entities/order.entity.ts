import { OrderStatus, PaymentStatus } from '../enums';

export class Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export class Order {
  id: string;
  orderNumber: string;
  userId?: string;
  sessionId?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;

  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;

  paymentMethod?: string;
  paymentId?: string;

  shippingAddress: Address;
  billingAddress: Address;
 
  customerEmail: string;
  customerPhone?: string;

  couponCode?: string;
  couponDiscount?: number;

  trackingNumber?: string;
  shippedAt?: Date;
  deliveredAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  items: OrderItem[];
  statusHistory?: OrderStatusHistory[];
  
  constructor(partial: Partial<Order>) {
    Object.assign(this, partial);
  }

  canTransitionTo(newStatus: OrderStatus): boolean {
    const allowedTransitions = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
    };
    
    return allowedTransitions[this.status]?.includes(newStatus) || false;
  }
  
  isEditable(): boolean {
    return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(this.status);
  }
  
  isCancellable(): boolean {
    return [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
    ].includes(this.status);
  }
  
  calculateTotal(): number {
    return this.subtotal + this.taxAmount + this.shippingCost - this.discountAmount;
  }
  
  getTotalItems(): number {
    return this.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  }
}

export class OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSku?: string;
  productSlug?: string;
  variantId?: string;
  variantName?: string;
  attributes?: Record<string, string>;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  productImage?: string;
  brand?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<OrderItem>) {
    Object.assign(this, partial);
  }

  calculateTotal(): number {
    return this.unitPrice * this.quantity;
  }

  getDisplayName(): string {
    return this.variantName || this.productName;
  }

  getAttributesDisplay(): string {
    if (!this.attributes || Object.keys(this.attributes).length === 0) {
      return '';
    }
    
    return Object.entries(this.attributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
}

export class OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  reason?: string;
  notes?: string;
  changedBy?: string;
  changedByType: 'SYSTEM' | 'USER' | 'ADMIN';
  createdAt: Date;
  
  constructor(partial: Partial<OrderStatusHistory>) {
    Object.assign(this, partial);
  }
  
  getChangeDescription(): string {
    if (this.fromStatus) {
      return `Changed from ${this.fromStatus} to ${this.toStatus}`;
    }
    return `Set to ${this.toStatus}`;
  }
}