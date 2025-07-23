import { CartItem } from './cart-item.entity';

export class Cart {
  id: string;
  userId?: string;
  sessionId?: string;
  items: CartItem[];
  
  itemCount: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingAmount: number;
  totalAmount: number;

  currency: string;
  couponCode?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  expiresAt?: Date;

  constructor(partial: Partial<Cart>) {
    Object.assign(this, partial);
    this.items = this.items || [];
    this.currency = this.currency || 'USD';
    this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.lastActivity = new Date();
  }

  addItem(item: CartItem): void {
    const existingItemIndex = this.items.findIndex(
      (i) => i.productId === item.productId && i.variantId === item.variantId
    );

    if (existingItemIndex >= 0) {
      this.items[existingItemIndex].quantity += item.quantity;
      this.items[existingItemIndex].updatedAt = new Date();
    } else {
      this.items.push(item);
    }

    this.updateCalculations();
  }

  updateItem(productId: string, variantId: string | null, quantity: number): boolean {
    const itemIndex = this.items.findIndex(
      (i) => i.productId === productId && i.variantId === variantId
    );

    if (itemIndex >= 0) {
      if (quantity <= 0) {
        this.items.splice(itemIndex, 1);
      } else {
        this.items[itemIndex].quantity = quantity;
        this.items[itemIndex].updatedAt = new Date();
      }
      this.updateCalculations();
      return true;
    }

    return false;
  }

  removeItem(productId: string, variantId?: string): boolean {
    const initialLength = this.items.length;
    this.items = this.items.filter(
      (item) => !(item.productId === productId && item.variantId === variantId)
    );

    if (this.items.length !== initialLength) {
      this.updateCalculations();
      return true;
    }

    return false;
  }

  clear(): void {
    this.items = [];
    this.couponCode = undefined;
    this.updateCalculations();
  }

  public updateCalculations(): void {
    this.itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);

    this.discountAmount = this.calculateDiscount();

    this.taxAmount = this.calculateTax(this.subtotal - this.discountAmount);

    this.shippingAmount = this.calculateShipping();

    this.totalAmount = this.subtotal - this.discountAmount + this.taxAmount + this.shippingAmount;
    
    this.updatedAt = new Date();
    this.lastActivity = new Date();
  }

  public calculateDiscount(): number {
    if (!this.couponCode) return 0;

    if (this.couponCode === 'SAVE10') {
      return this.subtotal * 0.1;
    }
    
    return 0;
  }

  public calculateTax(taxableAmount: number): number {
    const taxRate = 0.08; 
    return taxableAmount * taxRate;
  }

  private calculateShipping(): number {
    if (this.subtotal >= 100) return 0;
    return this.itemCount > 0 ? 10 : 0;
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}