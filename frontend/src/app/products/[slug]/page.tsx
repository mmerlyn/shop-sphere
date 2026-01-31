import ProductDetailClient from './ProductDetailClient';

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ slug: '_fallback' }];
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
