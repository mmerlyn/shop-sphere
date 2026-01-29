import Link from 'next/link';
import { Globe } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    shop: [
      { href: '/products', label: 'All Products' },
      { href: '/categories', label: 'Categories' },
      { href: '/products?featured=true', label: 'Featured' },
    ],
    account: [
      { href: '/account', label: 'My Account' },
      { href: '/account/orders', label: 'Order History' },
      { href: '/cart', label: 'Shopping Cart' },
    ],
    info: [
      { href: '/products', label: 'New Arrivals' },
      { href: '/categories', label: 'Shop by Category' },
      { href: '/products?featured=true', label: 'Best Sellers' },
    ],
  };

  return (
    <footer className="border-t bg-gradient-to-b from-muted/30 to-muted/60">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">ShopSphere</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Your one-stop destination for quality products at great prices.
            </p>
          </div>

          {/* Shop Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Shop</h4>
            <ul className="space-y-2">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Account</h4>
            <ul className="space-y-2">
              {footerLinks.account.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Discover</h4>
            <ul className="space-y-2">
              {footerLinks.info.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; {currentYear} ShopSphere. All rights reserved.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-muted">Next.js</span>
            <span className="text-xs px-2 py-1 rounded bg-muted">NestJS</span>
            <span className="text-xs px-2 py-1 rounded bg-muted">PostgreSQL</span>
            <span className="text-xs px-2 py-1 rounded bg-muted">Redis</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
