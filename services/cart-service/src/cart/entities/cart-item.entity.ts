export class CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  
  productName: string;
  productSku?: string;
  productImage?: string;
  category?: string;
  brand?: string;

  addedAt: Date;
  updatedAt: Date;

  isInStock: boolean;
  availableQuantity?: number;

  constructor(partial: Partial<CartItem>) {
    Object.assign(this, partial);
    this.quantity = this.quantity || 1;
    this.addedAt = this.addedAt || new Date();
    this.updatedAt = this.updatedAt || new Date();
    this.isInStock = this.isInStock ?? true;
    this.updateTotalPrice();
  }

  updateQuantity(newQuantity: number): void {
    this.quantity = Math.max(0, newQuantity);
    this.updatedAt = new Date();
    this.updateTotalPrice();
  }

  updatePrice(newUnitPrice: number): void {
    this.unitPrice = newUnitPrice;
    this.updatedAt = new Date();
    this.updateTotalPrice();
  }

  private updateTotalPrice(): void {
    this.totalPrice = this.unitPrice * this.quantity;
  }

  isValidQuantity(): boolean {
    if (!this.isInStock) return false;
    if (this.availableQuantity !== undefined) {
      return this.quantity <= this.availableQuantity;
    }
    return this.quantity > 0;
  }

  toJSON() {
    return {
      productId: this.productId,
      variantId: this.variantId,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalPrice: this.totalPrice,
      productName: this.productName,
      productSku: this.productSku,
      productImage: this.productImage,
      category: this.category,
      brand: this.brand,
      addedAt: this.addedAt,
      updatedAt: this.updatedAt,
      isInStock: this.isInStock,
      availableQuantity: this.availableQuantity,
    };
  }
}