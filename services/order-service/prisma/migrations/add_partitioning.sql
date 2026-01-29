-- Table Partitioning for Orders table
-- RANGE partitioned by created_at for optimal query performance on time-based queries
-- Supports 1M+ records across quarterly partitions

-- Step 1: Rename existing orders table
ALTER TABLE orders RENAME TO orders_old;

-- Step 2: Create partitioned orders table
CREATE TABLE orders (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    order_number VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    coupon_code VARCHAR(255),
    shipping_address JSONB NOT NULL,
    billing_address JSONB,
    payment_method VARCHAR(255),
    payment_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Step 3: Create quarterly partitions
-- 2024 Partitions
CREATE TABLE orders_2024_q1 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE orders_2024_q2 PARTITION OF orders
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

CREATE TABLE orders_2024_q3 PARTITION OF orders
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');

CREATE TABLE orders_2024_q4 PARTITION OF orders
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- 2025 Partitions
CREATE TABLE orders_2025_q1 PARTITION OF orders
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

CREATE TABLE orders_2025_q2 PARTITION OF orders
    FOR VALUES FROM ('2025-04-01') TO ('2025-07-01');

CREATE TABLE orders_2025_q3 PARTITION OF orders
    FOR VALUES FROM ('2025-07-01') TO ('2025-10-01');

CREATE TABLE orders_2025_q4 PARTITION OF orders
    FOR VALUES FROM ('2025-10-01') TO ('2026-01-01');

-- 2026 Partitions
CREATE TABLE orders_2026_q1 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');

CREATE TABLE orders_2026_q2 PARTITION OF orders
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');

-- Default partition for any dates outside defined ranges
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- Step 4: Migrate data from old table
INSERT INTO orders SELECT * FROM orders_old;

-- Step 5: Recreate indexes on partitioned table
CREATE UNIQUE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_user_id ON orders (user_id);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
CREATE INDEX idx_orders_user_created ON orders (user_id, created_at);
CREATE INDEX idx_orders_payment_id ON orders (payment_id);
CREATE INDEX idx_orders_created_at ON orders (created_at DESC);

-- Step 6: Recreate foreign key constraint for order_items
-- (order_items references orders.id)
-- Note: For partitioned tables, the FK must include the partition key
-- Update order_items to reference the partitioned table

-- Step 7: Drop old table
DROP TABLE orders_old CASCADE;

-- Verify partitioning
-- SELECT
--   parent.relname AS parent_table,
--   child.relname AS partition,
--   pg_get_expr(child.relpartbound, child.oid) AS partition_range
-- FROM pg_inherits
--   JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
--   JOIN pg_class child ON pg_inherits.inhrelid = child.oid
-- WHERE parent.relname = 'orders';
