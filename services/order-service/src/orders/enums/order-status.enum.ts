export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export const OrderStatusFlow = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export const OrderStatusDescriptions = {
  [OrderStatus.PENDING]: 'Order placed but not yet confirmed',
  [OrderStatus.CONFIRMED]: 'Order confirmed and payment verified',
  [OrderStatus.PROCESSING]: 'Order is being prepared for shipment',
  [OrderStatus.SHIPPED]: 'Order has been shipped',
  [OrderStatus.DELIVERED]: 'Order has been delivered to customer',
  [OrderStatus.CANCELLED]: 'Order has been cancelled',
  [OrderStatus.REFUNDED]: 'Order has been refunded',
};
