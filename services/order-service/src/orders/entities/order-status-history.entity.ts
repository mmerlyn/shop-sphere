import { OrderStatus } from '../enums';

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