# 🛒 shop-sphere
ShopSphere is a modern e-commerce platform designed for scale and performance. Built with a distributed microservices architecture to handle high traffic and provide seamless shopping experiences.

![Status](https://img.shields.io/badge/Status-In%20Progress-yellow)
![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Performance](https://img.shields.io/badge/Performance-2K%2B%20TPS-green)

## Key Features
- **Microservices Architecture** - 3/8 services completed with robust separation
- **Complete Authentication** - JWT-based auth with role-based access control
- **Advanced Product Catalog** - MongoDB-powered search with 34 API endpoints
- **Smart Shopping Cart** - Redis-backed cart with guest/user support
- **Multi-Database Strategy** - PostgreSQL + MongoDB + Redis optimization
- **Containerized Development** - Docker Compose with full infrastructure

## Tech Stack
### Backend Framework
- **NestJS** + **TypeScript** - Enterprise-grade Node.js framework
- **Prisma ORM** - Type-safe database access for PostgreSQL
- **Mongoose** - MongoDB object modeling
- **ioredis** - High-performance Redis client

### Databases & Storage
- **PostgreSQL** - User authentication & cart analytics
- **MongoDB** - Product catalog with advanced search indexing
- **Redis** - Shopping cart storage & session management
- **RabbitMQ** - Message queuing

## Microservices
✅ **Completed Services (4/8):**
- 👤 **User Service** - Complete authentication system with JWT, role-based access, profile management
- 📦 **Product Service** - Advanced catalog with MongoDB search, categories, variants, 34 endpoints
- 🛒 **Cart Service** - Redis-powered cart with guest support, coupon system, real-time calculations
- 🛍️ **Order Service** - Order processing & tracking

🏗️ **In Development (4/8):**
- 🔍 **Search Service** - Enhanced Elasticsearch integration
- 📧 **Notification Service** - Email & SMS notifications
- 📊 **Payment Service** - Secure payment handling
- 🌐 **API Gateway** - Request routing & rate limiting

## Current Performance & Features

### User Service Achievements
- **Complete Authentication Flow** - Registration, login, JWT refresh
- **Role-based Access Control** - Admin, user, guest permissions
- **Profile Management** - Full user data management
- **Security Features** - Password hashing, token validation

### Product Service Achievements  
- **34 API Endpoints** - Comprehensive product management
- **Advanced Search Engine** - MongoDB text indexing with filters
- **Category Hierarchy** - Multi-level product categorization
- **Product Variants** - Size, color, stock management
- **SEO Optimization** - URL slugs and metadata
- **Business Logic** - Related products, brands, vendor support

### Cart Service Achievements
- **12 API Endpoints** - Complete cart functionality
- **Redis Performance** - Sub-millisecond cart operations
- **Guest Cart Support** - Seamless anonymous shopping
- **Cart Merging** - Guest to user cart conversion
- **Coupon System** - Discount codes with business rules
- **Real-time Calculations** - Tax, shipping, discounts
- **Product Integration** - Live stock validation

## Target Performance Metrics
- **API Latency:** < 100ms average
- **Search Speed:** 50ms average response (planned)
- **Database Operations:** < 80ms CRUD operations
- **Throughput:** 2,000+ transactions/second (target)
- **Scalability:** Handles 1M+ product records

## Contributing
This project is currently in active development. The core microservices are functional but the platform is not yet production-ready.
**Ideas for additional services?** If you have suggestions for new microservices that would enhance this e-commerce platform, feel free to contribute! Open an issue or submit a pull request with your ideas.

## Potential service ideas I am considering:
- **Review & Rating Service**
- **Inventory Management Service**
- **Recommendation Engine**
- **Analytics & Reporting Service**
- **Coupon & Promotion Service**

Feel free to check back for updates 

⭐ **Star this repo if you find the microservices architecture interesting!**