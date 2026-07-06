-- Seed the Catalog Postgres (source of truth) with :n products across 10 categories.
-- Run server-side via generate_series so 1M rows insert in seconds, not minutes.
-- IDs are deterministic ('prod-<n>') so Elasticsearch + Inventory can mirror them.
\set ON_ERROR_STOP on

-- 10 categories
INSERT INTO categories (id, name, slug, "isActive", "createdAt", "updatedAt")
SELECT 'cat-' || g,
       'Category ' || g,
       'category-' || g,
       true, now(), now()
FROM generate_series(0, 9) AS g
ON CONFLICT (id) DO NOTHING;

-- :n products. Searchable names/brands come from small vocabularies so k6
-- query terms (laptop, phone, ...) actually match documents.
INSERT INTO products (
  id, name, description, sku, slug, price, "categoryId", brand,
  images, inventory, "lowStockThreshold", "isActive", "isFeatured",
  tags, "createdAt", "updatedAt"
)
SELECT
  'prod-' || n,
  (ARRAY['Laptop','Phone','Headphones','Camera','Watch','Shoes','Backpack','Keyboard','Monitor','Chair','Desk','Tablet','Speaker','Drone','Printer','Router','Microphone','Charger','Lamp','Bottle'])[1 + (n % 20)]
    || ' ' || (ARRAY['Acme','Globex','Umbrella','Initech','Soylent','Stark','Wayne','Wonka','Hooli','Pied'])[1 + (n % 10)]
    || ' ' || n,
  'High quality '
    || (ARRAY['Laptop','Phone','Headphones','Camera','Watch','Shoes','Backpack','Keyboard','Monitor','Chair','Desk','Tablet','Speaker','Drone','Printer','Router','Microphone','Charger','Lamp','Bottle'])[1 + (n % 20)]
    || ' built for everyday use.',
  'SKU-' || n,
  'product-' || n,
  round((random() * 490 + 10)::numeric, 2),
  'cat-' || (n % 10),
  (ARRAY['Acme','Globex','Umbrella','Initech','Soylent','Stark','Wayne','Wonka','Hooli','Pied'])[1 + (n % 10)],
  ARRAY['https://picsum.photos/seed/' || n || '/400'],
  1000000,
  10,
  true,
  (n % 50 = 0),
  ARRAY[
    lower((ARRAY['Laptop','Phone','Headphones','Camera','Watch','Shoes','Backpack','Keyboard','Monitor','Chair','Desk','Tablet','Speaker','Drone','Printer','Router','Microphone','Charger','Lamp','Bottle'])[1 + (n % 20)]),
    lower((ARRAY['Acme','Globex','Umbrella','Initech','Soylent','Stark','Wayne','Wonka','Hooli','Pied'])[1 + (n % 10)])
  ],
  now() - ((n % 1000000) || ' seconds')::interval,
  now()
FROM generate_series(1, :n) AS n
ON CONFLICT (id) DO NOTHING;

SELECT count(*) AS catalog_products FROM products;
