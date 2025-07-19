import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { MongoError } from 'mongodb';

@Catch(MongoError)
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: MongoError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception.code === 11000) {
      status = HttpStatus.CONFLICT;
      message = 'Duplicate key error';
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}