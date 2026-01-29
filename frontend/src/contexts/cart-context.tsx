'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Cart, CartItem } from '@/types';
import { api } from '@/lib/api';
import { useAuth } from './auth-context';

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  itemCount: number;
  addItem: (productId: string, quantity?: number) => Promise<void>;
  updateItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_ID_KEY = 'shop_sphere_cart_id';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated, user } = useAuth();

  const getOrCreateCart = useCallback(async (): Promise<string> => {
    let cartId = localStorage.getItem(CART_ID_KEY);

    if (cartId) {
      try {
        const response = await api.getCart(cartId);
        setCart(response.data);
        return cartId;
      } catch {
        // Cart doesn't exist anymore, create a new one
        localStorage.removeItem(CART_ID_KEY);
      }
    }

    // Create new cart
    const response = await api.createCart();
    cartId = response.data.id;
    localStorage.setItem(CART_ID_KEY, cartId);
    setCart(response.data);
    return cartId;
  }, []);

  const loadCart = useCallback(async () => {
    setIsLoading(true);
    try {
      await getOrCreateCart();
    } catch (error) {
      console.error('Failed to load cart:', error);
    } finally {
      setIsLoading(false);
    }
  }, [getOrCreateCart]);

  // Merge guest cart when user logs in
  useEffect(() => {
    const mergeGuestCart = async () => {
      if (isAuthenticated && user) {
        const guestCartId = localStorage.getItem(CART_ID_KEY);
        if (guestCartId) {
          try {
            const response = await api.mergeCart(guestCartId);
            localStorage.setItem(CART_ID_KEY, response.data.id);
            setCart(response.data);
          } catch {
            // If merge fails, just load fresh cart
            await loadCart();
          }
        }
      }
    };

    mergeGuestCart();
  }, [isAuthenticated, user, loadCart]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const refreshCart = async () => {
    const cartId = localStorage.getItem(CART_ID_KEY);
    if (cartId) {
      try {
        const response = await api.getCart(cartId);
        setCart(response.data);
      } catch {
        await loadCart();
      }
    }
  };

  const addItem = async (productId: string, quantity = 1) => {
    const cartId = await getOrCreateCart();
    const response = await api.addToCart(cartId, productId, quantity);
    setCart(response.data);
  };

  const updateItem = async (productId: string, quantity: number) => {
    if (!cart) return;
    const response = await api.updateCartItem(cart.id, productId, quantity);
    setCart(response.data);
  };

  const removeItem = async (productId: string) => {
    if (!cart) return;
    const response = await api.removeFromCart(cart.id, productId);
    setCart(response.data);
  };

  const applyCoupon = async (code: string) => {
    if (!cart) return;
    const response = await api.applyCoupon(cart.id, code);
    setCart(response.data);
  };

  const removeCoupon = async () => {
    if (!cart) return;
    const response = await api.removeCoupon(cart.id);
    setCart(response.data);
  };

  const clearCart = () => {
    localStorage.removeItem(CART_ID_KEY);
    setCart(null);
  };

  const itemCount = cart?.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) || 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        itemCount,
        addItem,
        updateItem,
        removeItem,
        applyCoupon,
        removeCoupon,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
