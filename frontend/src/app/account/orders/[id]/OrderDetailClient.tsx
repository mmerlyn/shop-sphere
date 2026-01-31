'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Package, Truck, MapPin, CreditCard, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { Order, OrderStatus } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

const statusColors: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PROCESSING: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  SHIPPED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  DELIVERED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  REFUNDED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

const statusSteps: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

export default function OrderDetailClient() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account/orders');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const response = await api.getOrder(params.id as string);
        setOrder(response.data);
      } catch (error) {
        console.error('Failed to load order:', error);
        toast.error('Order not found');
        router.push('/account/orders');
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated && params.id) {
      loadOrder();
    }
  }, [isAuthenticated, params.id, router]);

  const handleCancelOrder = async () => {
    if (!order) return;

    setIsCancelling(true);
    try {
      const response = await api.cancelOrder(order.id);
      setOrder(response.data);
      toast.success('Order cancelled successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel order');
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = order && ['PENDING', 'CONFIRMED'].includes(order.status);
  const currentStepIndex = order ? statusSteps.indexOf(order.status) : -1;

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/account/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Link>
        </Button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-4">
          <div>
            <h1 className="text-3xl font-bold">Order #{order.orderNumber}</h1>
            <p className="text-muted-foreground">
              Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <Badge className={`${statusColors[order.status]} text-sm px-3 py-1`}>
            {order.status}
          </Badge>
        </div>
      </div>

      {/* Order Progress */}
      {!['CANCELLED', 'REFUNDED'].includes(order.status) && (
        <Card className="mb-8">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, index) => {
                const isComplete = currentStepIndex >= index;
                const isCurrent = currentStepIndex === index;

                return (
                  <div key={step} className="flex-1 relative">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center z-10 ${
                          isComplete
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      >
                        {isComplete ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <span className="text-sm">{index + 1}</span>
                        )}
                      </div>
                      <span className={`text-xs mt-2 ${isComplete ? 'font-medium' : 'text-muted-foreground'}`}>
                        {step}
                      </span>
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div
                        className={`absolute top-5 left-1/2 w-full h-0.5 ${
                          currentStepIndex > index ? 'bg-primary' : 'bg-muted'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative w-20 h-20 flex-shrink-0 rounded bg-muted">
                      <Image
                        src={item.image || '/placeholder-product.svg'}
                        alt={item.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} each</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-4 w-4" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-sm">
                  <p>{order.shippingAddress.street}</p>
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                    {order.shippingAddress.zipCode}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                </address>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  Billing Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <address className="not-italic text-sm">
                  {order.billingAddress ? (
                    <>
                      <p>{order.billingAddress.street}</p>
                      <p>
                        {order.billingAddress.city}, {order.billingAddress.state}{' '}
                        {order.billingAddress.zipCode}
                      </p>
                      <p>{order.billingAddress.country}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Same as shipping address</p>
                  )}
                </address>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount{order.couponCode && ` (${order.couponCode})`}</span>
                    <span>-${order.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {order.shippingCost === 0 ? 'Free' : `$${order.shippingCost.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>${order.tax.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4" />
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm capitalize">{order.paymentMethod.replace('_', ' ')}</p>
              {order.paymentId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Transaction ID: {order.paymentId}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Order Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Cancel Order */}
          {canCancel && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancelOrder}
              disabled={isCancelling}
            >
              <X className="mr-2 h-4 w-4" />
              {isCancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
