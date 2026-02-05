'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Product } from '@/types';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.inventory <= 0) {
      toast.error('Product is out of stock');
      return;
    }

    setIsAdding(true);
    try {
      await addItem(product.id);
      toast.success(`${product.name} added to cart`);
    } catch (error) {
      toast.error('Failed to add item to cart');
      console.error(error);
    } finally {
      setIsAdding(false);
    }
  };

  const price = Number(product.price);
  const comparePrice = product.comparePrice ? Number(product.comparePrice) : null;

  const discount = comparePrice
    ? Math.round(((comparePrice - price) / comparePrice) * 100)
    : 0;

  const imageUrl = product.images?.[0] || '/placeholder-product.svg';

  return (
    <Link href={`/products/${product.slug}`}>
      <Card className="group h-full overflow-hidden border-border/50 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/50">
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
          {discount > 0 && (
            <Badge className="absolute top-3 left-3 shadow-md" variant="destructive">
              -{discount}% OFF
            </Badge>
          )}
          {product.isFeatured && (
            <Badge className="absolute top-3 right-3 bg-primary shadow-md">
              Featured
            </Badge>
          )}
          {product.inventory <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <Badge variant="destructive" className="text-lg px-4 py-1">
                Out of Stock
              </Badge>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          <div className="space-y-1">
            {product.brand && (
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {product.brand}
              </p>
            )}
            <h3 className="font-medium line-clamp-2 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-bold">${price.toFixed(2)}</span>
            {comparePrice && (
              <span className="text-sm text-muted-foreground line-through">
                ${comparePrice.toFixed(2)}
              </span>
            )}
          </div>

          {product.inventory > 0 && product.inventory <= product.lowStockThreshold && (
            <p className="mt-1 text-xs text-orange-600">
              Only {product.inventory} left in stock
            </p>
          )}
        </CardContent>

        <CardFooter className="p-4 pt-0">
          <Button
            className="w-full"
            onClick={handleAddToCart}
            disabled={isAdding || product.inventory <= 0}
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {isAdding ? 'Adding...' : 'Add to Cart'}
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
}
