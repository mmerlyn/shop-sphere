import OrderDetailClient from './OrderDetailClient';

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ id: '_fallback' }];
}

export default function OrderDetailPage() {
  return <OrderDetailClient />;
}
