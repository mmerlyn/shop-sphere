import {
  Controller,
  All,
  Req,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProxyService } from './proxy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  { service: 'users', paths: ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/health'] },
  { service: 'products', paths: ['/api/products', '/api/categories', '/api/health'] },
  { service: 'cart', paths: ['/api/health'] },
  { service: 'orders', paths: ['/api/health'] },
  { service: 'notifications', paths: ['/api/health'] },
  { service: 'payments', paths: ['/api/health'] },
  { service: 'reviews', paths: ['/api/reviews/product', '/api/health'] },
];

@Controller()
@UseGuards(JwtAuthGuard)
export class ProxyController {
  constructor(private proxyService: ProxyService) {}

  private isPublicRoute(service: string, path: string): boolean {
    const serviceConfig = PUBLIC_ROUTES.find((r) => r.service === service);
    if (!serviceConfig) return false;

    return serviceConfig.paths.some(
      (publicPath) =>
        path === publicPath ||
        path.startsWith(publicPath + '/') ||
        (publicPath.includes('/api/products') && path.match(/^\/api\/products(\/|$)/)) ||
        (publicPath.includes('/api/categories') && path.match(/^\/api\/categories(\/|$)/)) ||
        (publicPath.includes('/api/reviews/product') && path.match(/^\/api\/reviews\/product(\/|$)/))
    );
  }

  // User Service routes
  @All('auth/*')
  @Public()
  async proxyAuth(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('users', req, res);
  }

  @All('users/*')
  async proxyUsers(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('users', req, res);
  }

  // Product Service routes
  @All('products')
  @Public()
  async proxyProductsList(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('products', req, res);
  }

  @All('products/*')
  @Public()
  async proxyProducts(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('products', req, res);
  }

  @All('categories')
  @Public()
  async proxyCategoriesList(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('products', req, res);
  }

  @All('categories/*')
  @Public()
  async proxyCategories(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('products', req, res);
  }

  // Upload routes (requires authentication)
  @All('upload')
  async proxyUploadRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('products', req, res);
  }

  @All('upload/*')
  async proxyUpload(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('products', req, res);
  }

  // Cart Service routes (public for guest carts)
  @All('cart')
  @Public()
  async proxyCartRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('cart', req, res);
  }

  @All('cart/*')
  @Public()
  async proxyCart(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('cart', req, res);
  }

  // Order Service routes
  @All('orders')
  async proxyOrdersRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('orders', req, res);
  }

  @All('orders/*')
  async proxyOrders(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('orders', req, res);
  }

  @All('checkout/*')
  async proxyCheckout(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('orders', req, res);
  }

  // Payment Service routes (now standalone)
  @All('payments/webhook')
  @Public()
  async proxyPaymentWebhook(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('payments', req, res);
  }

  @All('payments')
  async proxyPaymentsRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('payments', req, res);
  }

  @All('payments/*')
  async proxyPayments(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('payments', req, res);
  }

  // Notification Service routes
  @All('notifications')
  async proxyNotificationsRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('notifications', req, res);
  }

  @All('notifications/*')
  async proxyNotifications(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('notifications', req, res);
  }

  // Review Service routes
  @All('reviews/product/*')
  @Public()
  async proxyReviewsPublic(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('reviews', req, res);
  }

  @All('reviews')
  async proxyReviewsRoot(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('reviews', req, res);
  }

  @All('reviews/*')
  async proxyReviews(@Req() req: Request, @Res() res: Response) {
    return this.proxyRequest('reviews', req, res);
  }

  private async proxyRequest(
    service: string,
    req: Request,
    res: Response,
  ) {
    try {
      // Build the path to forward
      const path = req.originalUrl;

      // Forward user info in headers if authenticated
      const headers: Record<string, string> = {};
      if ((req as any).user) {
        headers['x-user-id'] = (req as any).user.id;
        headers['x-user-email'] = (req as any).user.email;
        headers['x-user-role'] = (req as any).user.role;
      }

      // Forward authorization header
      if (req.headers.authorization) {
        headers['authorization'] = req.headers.authorization;
      }

      const result = await this.proxyService.forward(
        service,
        path,
        req.method as any,
        req.body,
        headers,
        req.query as Record<string, any>,
      );

      return res.status(HttpStatus.OK).json(result);
    } catch (error: any) {
      const status = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.response || error.message || 'Internal error';
      return res.status(status).json(message);
    }
  }
}
