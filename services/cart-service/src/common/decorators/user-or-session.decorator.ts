import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CartUserContext {
  userId?: string;
  sessionId?: string;
  token?: string;
}

export const UserOrSession = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CartUserContext => {
    const request = ctx.switchToHttp().getRequest();
    
    const userId = request.user?.id || request.userId;
    const sessionId = request.session?.id || request.sessionId || request.headers['x-session-id'];
    const token = request.headers.authorization?.replace('Bearer ', '');

    return {
      userId,
      sessionId,
      token,
    };
  },
);