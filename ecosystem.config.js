// PM2 Ecosystem Configuration for ShopSphere
// Runs all microservices in a single container

module.exports = {
  apps: [
    {
      name: 'redis',
      script: 'redis-server',
      args: '--port 6379 --bind 127.0.0.1',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'api-gateway',
      cwd: './services/api-gateway',
      script: 'dist/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
        USER_SERVICE_URL: 'http://localhost:3001',
        PRODUCT_SERVICE_URL: 'http://localhost:3002',
        CART_SERVICE_URL: 'http://localhost:3003',
        ORDER_SERVICE_URL: 'http://localhost:3004',
        NOTIFICATION_SERVICE_URL: 'http://localhost:3005',
        PAYMENT_SERVICE_URL: 'http://localhost:3006',
        REVIEW_SERVICE_URL: 'http://localhost:3007',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
      }
    },
    {
      name: 'user-service',
      cwd: './services/user-service',
      script: 'dist/src/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
      }
    },
    {
      name: 'product-service',
      cwd: './services/product-service',
      script: 'dist/src/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
      }
    },
    {
      name: 'cart-service',
      cwd: './services/cart-service',
      script: 'dist/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: 6379,
        PRODUCT_SERVICE_URL: 'http://localhost:3002',
      }
    },
    {
      name: 'order-service',
      cwd: './services/order-service',
      script: 'dist/src/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3004,
        CART_SERVICE_URL: 'http://localhost:3003',
        PRODUCT_SERVICE_URL: 'http://localhost:3002',
        PAYMENT_SERVICE_URL: 'http://localhost:3006',
        NOTIFICATION_SERVICE_URL: 'http://localhost:3005',
      }
    },
    {
      name: 'notification-service',
      cwd: './services/notification-service',
      script: 'dist/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      }
    },
    {
      name: 'payment-service',
      cwd: './services/payment-service',
      script: 'dist/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3006,
        ORDER_SERVICE_URL: 'http://localhost:3004',
      }
    },
    {
      name: 'review-service',
      cwd: './services/review-service',
      script: 'dist/main.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3007,
        ORDER_SERVICE_URL: 'http://localhost:3004',
      }
    },
  ]
};
