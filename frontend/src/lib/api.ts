import type {
  User,
  LoginResponse,
  Product,
  Category,
  Cart,
  Order,
  ApiResponse,
  PaginatedResponse,
  ProductFilters,
  Address,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private accessToken: string | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints - backend returns data directly, wrap it
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<ApiResponse<LoginResponse>> {
    const result = await this.request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: true, data: result };
  }

  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const result = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return { success: true, data: result };
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    const result = await this.request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    return { success: true, data: result };
  }

  async logout(refreshToken: string): Promise<ApiResponse<null>> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    return { success: true, data: null };
  }

  async getProfile(): Promise<ApiResponse<User>> {
    const result = await this.request<User>('/auth/profile');
    return { success: true, data: result };
  }

  // Product endpoints
  async getProducts(filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    const query = params.toString();
    return this.request(`/products${query ? `?${query}` : ''}`);
  }

  async getProduct(idOrSlug: string): Promise<ApiResponse<Product>> {
    // Check if it's a UUID (id) or slug
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    const endpoint = isUuid ? `/products/${idOrSlug}` : `/products/slug/${idOrSlug}`;
    const data = await this.request<Product>(endpoint);
    return { success: true, data };
  }

  async getFeaturedProducts(): Promise<ApiResponse<Product[]>> {
    const data = await this.request<Product[]>('/products/featured');
    return { success: true, data };
  }

  async searchProducts(query: string, filters?: ProductFilters): Promise<PaginatedResponse<Product>> {
    const params = new URLSearchParams({ search: query });
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && key !== 'search') {
          params.append(key, String(value));
        }
      });
    }
    return this.request(`/products/search?${params.toString()}`);
  }

  // Category endpoints - returns data directly, wrap it
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const data = await this.request<Category[]>('/categories');
    return { success: true, data };
  }

  async getCategory(idOrSlug: string): Promise<ApiResponse<Category>> {
    const data = await this.request<Category>(`/categories/${idOrSlug}`);
    return { success: true, data };
  }

  // Cart endpoints - cart service returns data directly, wrap it
  async createCart(): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>('/cart', { method: 'POST' });
    return { success: true, data };
  }

  async getCart(cartId: string): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${cartId}`);
    return { success: true, data };
  }

  async addToCart(cartId: string, productId: string, quantity: number): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${cartId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
    return { success: true, data };
  }

  async updateCartItem(cartId: string, productId: string, quantity: number): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${cartId}/items/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
    return { success: true, data };
  }

  async removeFromCart(cartId: string, productId: string): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${cartId}/items/${productId}`, {
      method: 'DELETE',
    });
    return { success: true, data };
  }

  async applyCoupon(cartId: string, couponCode: string): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${cartId}/coupon`, {
      method: 'POST',
      body: JSON.stringify({ code: couponCode }),
    });
    return { success: true, data };
  }

  async removeCoupon(cartId: string): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${cartId}/coupon`, {
      method: 'DELETE',
    });
    return { success: true, data };
  }

  async mergeCart(guestCartId: string): Promise<ApiResponse<Cart>> {
    const data = await this.request<Cart>(`/cart/${guestCartId}/merge`, {
      method: 'POST',
    });
    return { success: true, data };
  }

  // Order endpoints - backend returns data directly, wrap it
  async createOrder(data: {
    cartId: string;
    shippingAddress: Address;
    billingAddress?: Address;
    paymentMethod: string;
    notes?: string;
  }): Promise<ApiResponse<Order>> {
    const result = await this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { success: true, data: result };
  }

  async getOrders(page = 1, limit = 10): Promise<PaginatedResponse<Order>> {
    return this.request(`/orders?page=${page}&limit=${limit}`);
  }

  async getOrder(id: string): Promise<ApiResponse<Order>> {
    const result = await this.request<Order>(`/orders/${id}`);
    return { success: true, data: result };
  }

  async cancelOrder(id: string): Promise<ApiResponse<Order>> {
    const result = await this.request<Order>(`/orders/${id}/cancel`, {
      method: 'POST',
    });
    return { success: true, data: result };
  }

  // Payment endpoints - backend returns data directly, wrap it
  async createPaymentIntent(amount: number, orderId?: string): Promise<ApiResponse<{
    clientSecret: string;
    paymentIntentId: string;
  }>> {
    const result = await this.request<{ clientSecret: string; paymentIntentId: string }>('/payments/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, orderId }),
    });
    return { success: true, data: result };
  }

  async confirmPayment(paymentIntentId: string, orderId: string): Promise<ApiResponse<Order>> {
    const result = await this.request<Order>('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId, orderId }),
    });
    return { success: true, data: result };
  }
}

export const api = new ApiClient();
