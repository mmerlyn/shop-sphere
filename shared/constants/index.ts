export const SERVICE_PORTS = {
  USER_SERVICE: Number(process.env.USER_SERVICE_PORT) || 3001,
  PRODUCT_SERVICE: Number(process.env.PRODUCT_SERVICE_PORT) || 3002,
  CART_SERVICE: Number(process.env.CART_SERVICE_PORT) || 3003,
  ORDER_SERVICE: Number(process.env.ORDER_SERVICE_PORT) || 3004,
  API_GATEWAY: Number(process.env.API_GATEWAY_PORT) || 8000,
};

export const DATABASE_URLS = {
  USERS: process.env.DATABASE_URL_USERS || '',
  PRODUCTS: process.env.DATABASE_URL_PRODUCTS || '',
  ORDERS: process.env.DATABASE_URL_ORDERS || '',
};

export const REDIS_URL = process.env.REDIS_URL || '';
export const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || '';

export const JWT_CONSTANTS = {
  ACCESS_TOKEN_EXPIRY: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};
