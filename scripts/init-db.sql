CREATE DATABASE IF NOT EXISTS shopsphere_users;
CREATE DATABASE IF NOT EXISTS shopsphere_cart;
CREATE DATABASE IF NOT EXISTS shopsphere_orders;
CREATE DATABASE IF NOT EXISTS shopsphere_payments;

CREATE USER IF NOT EXISTS cart_user WITH PASSWORD 'cart_password';
GRANT ALL PRIVILEGES ON DATABASE shopsphere_cart TO cart_user;
 
CREATE USER IF NOT EXISTS order_user WITH PASSWORD 'order_password';
GRANT ALL PRIVILEGES ON DATABASE shopsphere_orders TO order_user;

CREATE USER IF NOT EXISTS payment_user WITH PASSWORD 'payment_password';
GRANT ALL PRIVILEGES ON DATABASE shopsphere_payments TO payment_user;

GRANT ALL PRIVILEGES ON DATABASE shopsphere_users TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shopsphere_cart TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shopsphere_orders TO postgres;
GRANT ALL PRIVILEGES ON DATABASE shopsphere_payments TO postgres;

-- Initialize the order service database
CREATE DATABASE IF NOT EXISTS order_service_db;

-- Create user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'order_user') THEN

      CREATE ROLE order_user LOGIN PASSWORD 'order_password';
   END IF;
END
$do$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE order_service_db TO order_user;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create the orders database
CREATE DATABASE IF NOT EXISTS shopsphere_orders;

-- Create the order user
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'order_user') THEN

      CREATE ROLE order_user LOGIN PASSWORD 'order_password';
   END IF;
END
$do$;

-- Grant all privileges to the order user
GRANT ALL PRIVILEGES ON DATABASE shopsphere_orders TO order_user;
ALTER DATABASE shopsphere_orders OWNER TO order_user;

-- Connect to the orders database
\c shopsphere_orders;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO order_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO order_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO order_user;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges on extensions
ALTER EXTENSION "uuid-ossp" OWNER TO order_user;
ALTER EXTENSION "pg_trgm" OWNER TO order_user;

-- Grant default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO order_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO order_user;
