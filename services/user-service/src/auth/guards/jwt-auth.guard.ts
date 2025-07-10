import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      if (info instanceof TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      } else if (info instanceof JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      } else {
        throw new UnauthorizedException('Authentication failed');
      }
    }
    return user;
  }
}
