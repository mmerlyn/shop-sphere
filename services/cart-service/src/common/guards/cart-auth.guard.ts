import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { UserService } from '../../cart/external/user/user.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CartAuthGuard implements CanActivate {
  private readonly logger = new Logger(CartAuthGuard.name);

  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const user = await this.userService.validateToken(token);
        if (user) {
          request.user = user;
          request.userId = user.id;
          this.logger.log(`Authenticated user: ${user.id}`);
          return true;
        }
      } catch (error) {
        this.logger.warn(`Token validation failed: ${error.message}`);
      }
    }

    let sessionId = request.headers['x-session-id'] || request.session?.id;
    
    if (!sessionId) {
      sessionId = uuidv4();
      response.setHeader('X-Session-ID', sessionId);
      this.logger.log(`Created new session: ${sessionId}`);
    }

    request.sessionId = sessionId;
    return true;
  }
}