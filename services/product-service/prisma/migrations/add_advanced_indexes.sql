-- Advanced indexes for product search optimization
-- GIN full-text search index on products (name + description)
CREATE INDEX IF NOT EXISTS idx_products_fulltext
ON products USING GIN (to_tsvector('english', name || ' ' || description));

-- Partial index on active products sorted by creation date
CREATE INDEX IF NOT EXISTS idx_products_active_created
ON products (created_at DESC) WHERE is_active = true;

-- Partial index on featured active products
CREATE INDEX IF NOT EXISTS idx_products_featured_active
ON products (created_at DESC) WHERE is_active = true AND is_featured = true;

-- Index on product price for range queries with active filter
CREATE INDEX IF NOT EXISTS idx_products_active_price
ON products (price) WHERE is_active = true;

-- Composite index for brand + category filtering
CREATE INDEX IF NOT EXISTS idx_products_brand_category
ON products (brand, category_id) WHERE is_active = true;
