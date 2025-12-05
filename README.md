# ShopSphere

E-commerce platform built with microservices architecture to demonstrate distributed systems design, independent scaling, and service isolation.

## System Design

**Architecture Pattern:** Microservices
E-commerce domains (users, products, cart, orders) have different scaling needs and data models. Separating them allows independent deployment, technology choices, and horizontal scaling per service.

```
┌─────────────────────────────────────────┐
│         API Gateway (Port 8000)         │
│   • Request routing to services         │
│   • JWT authentication                  │
│   • Rate limiting                       │
└───────────┬─────────────────────────────┘
            │
    ┌───────┼────────┬────────┬────────┐
    ↓       ↓        ↓        ↓        ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  User  │ │Product │ │  Cart  │ │ Order  │
│ :3001  │ │ :3002  │ │ :3003  │ │ :3004  │
└────┬───┘ └───┬────┘ └───┬────┘ └───┬────┘
     ↓         ↓          ↓          ↓
  Postgres  Postgres    Redis     Postgres
            Elastic
```

## Key Features

**Customer Features**
- User registration and JWT authentication
- Product search with filters (category, price, brand)
- Guest cart support (no login required)
- Cart persistence across sessions
- Secure checkout with Stripe
- Order tracking dashboard
- Coupon code support

**Admin Features**
- Product management (CRUD)
- Category management
- Inventory tracking with low-stock alerts
- Order fulfillment workflow
- User role management

**Technical Features**
- Independent service deployment
- Database per service pattern
- Event-driven communication (future: RabbitMQ)
- Distributed caching
- Horizontal scaling capability
- Health checks for each service
- Centralized logging (future: ELK stack)

## Database Design Decisions

**Why separate databases per service?**
- Each service owns its data (no shared database antipattern)
- Different databases optimized for different use cases
- Prevents tight coupling between services
- Allows independent scaling

**Database choices:**
- **PostgreSQL** for transactional data (users, orders, products)
- **Redis** for temporary data (cart, sessions)
- **Elasticsearch** for search workloads (product search)

## Author

Merlyn Mercylona
[GitHub](https://github.com/mmerlyn) • [LinkedIn](https://linkedin.com/in/merlynmercylona)
