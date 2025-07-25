export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export const PaymentStatusDescriptions = {
  [PaymentStatus.PENDING]: 'Payment is being processed',
  [PaymentStatus.PAID]: 'Payment completed successfully',
  [PaymentStatus.FAILED]: 'Payment failed or was declined',
  [PaymentStatus.REFUNDED]: 'Payment was fully refunded',
  [PaymentStatus.PARTIALLY_REFUNDED]: 'Payment was partially refunded',
};